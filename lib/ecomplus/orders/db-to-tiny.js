'use strict'
// logger
const logger = require('console-files')

// get app config
const getConfig = require('../../store-api/get-config')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// mysql abstract
const mysql = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// parse to tiny schema
const TinySchema = require('../../schemas/ecom/orders-to-tiny')

// tiny client
const Tiny = require('../../tiny/client')

// patch app
const updateAppHiddenData = require('../../store-api/update-config')

module.exports = (appSdk) => {
  logger.log('--> Running service to sent orders in database to tiny')

  const save = () => new Promise(async resolve => {
    let currentStore = 0
    const stores = await getStores()

    const task = async () => {
      if (stores[currentStore] && stores[currentStore].store_id) {
        const store = stores[currentStore]
        const storeId = store.store_id

        const nextStore = () => {
          currentStore++
          return task()
        }

        mysql.query('SELECT * FROM orders WHERE store_id = ? AND error = ? AND tiny_id IS NULL ORDER BY order_number DESC LIMIT 100 ', [storeId, 0])
          .then(rows => {
            if (rows && rows.length) {
              return getConfig({ appSdk, storeId }, true)

                .then(async configObj => {
                  appSdk
                    .getAuth(storeId)

                    .then(({ myId, accessToken }) => {
                      let currentOrder = 0
                      const tiny = new Tiny(configObj.access_token)
                      const lastSyncError = []

                      const recursiveSync = () => {
                        const order = rows[currentOrder]
                        const nextOrders = () => {
                          currentOrder++
                          return recursiveSync()
                        }

                        if (order) {
                          const url = `/orders/${order._id}.json`
                          ecomClient
                            .store({
                              url,
                              storeId,
                              authenticationId: myId,
                              accessToken
                            })

                            .then(({ data }) => {
                              const tinySchema = TinySchema(data)
                              return { data, tinySchema }
                            })

                            .then(({ data, tinySchema }) => {
                              return tiny
                                .addOrders(tinySchema)

                                .then(response => {
                                  const { retorno } = response.data
                                  const { status, registros } = retorno
                                  if (retorno && parseInt(retorno.status_processamento) < 3) {
                                    if (status === 'Erro') {
                                      if (!isNaN(parseInt(retorno.codigo_erro)) && parseInt(retorno.codigo_erro) === 6) {
                                        // to many requests
                                        logger.log(`--> Api limit reached, waiting 1m | Queue size: ${(rows.length - currentOrder)}`)
                                        setTimeout(() => {
                                          // wait 1m and try try again
                                          recursiveSync()
                                        }, 60000)
                                      } else {
                                        const { registro } = registros
                                        const { erros } = registro
                                        if (parseInt(registro.codigo_erro) === 31) {
                                          // bad request
                                          if (erros && erros.length) {
                                            const err = {
                                              resource_id: order._id,
                                              error: erros[0].erro
                                            }
                                            lastSyncError.push(err)
                                            mysql.query('UPDATE orders SET error = ? WHERE store_id = ? AND _id = ?', [1, storeId, data._id])
                                            logger.log(`[!!] Pedido ${data._id} não enviado ao tiny devido erro em seu cadastro ->> ${erros[0].erro}`)
                                          }
                                          nextOrders()
                                        } else if (parseInt(registro.codigo_erro) === 30) {
                                          // duplicy
                                          logger.log(`[!!] Pedido ${data._id} já se encontra no tiny`)
                                          nextOrders()
                                        }
                                      }
                                    }
                                  } else {
                                    // success
                                    // update tiny_id at database
                                    const { registro } = registros
                                    const { id } = registro
                                    const orderNumber = order.order_number
                                    // update tiny_id of order in database
                                    mysql.updateTinyIdOrder(id, orderNumber, storeId)
                                    logger.log(`--> Pedido ${orders._id} enviado ao tiny com sucesso`)
                                    nextOrders()
                                  }
                                })

                                .catch(resp => {
                                  if (resp.status === 500) {
                                    setTimeout(() => {
                                      recursiveSync()
                                    }, 3000)
                                  } else {
                                    nextOrders()
                                  }
                                })
                            })

                            .catch(error => {
                              if (error.response && error.response.status >= 500) {
                                setTimeout(() => {
                                  recursiveSync()
                                }, 3000)
                              }
                            })
                        } else {
                          // salve log at app?
                          if (lastSyncError.length) {
                            const body = {
                              last_sync_error: {
                                orders: lastSyncError
                              }
                            }
                            updateAppHiddenData(appSdk, storeId, configObj, body)
                          }
                          // next store
                          nextStore()
                        }
                      }
                      // start sync recursive
                      recursiveSync()
                    })
                })
                .catch(e => logger.error('ORDERS_DB_TO_TINY_ERR', e))
            } else {
              nextStore()
            }
          })
      } else {
        resolve()
      }
    }
    task()
  })

  save()
    .then(() => {
      const interval = (process.env.DB_SYNC_ORDERS_INTERVAL || 5) * 60 * 1000
      setTimeout(() => {
        return save()
      }, interval)
      logger.log(`--> Sent products to tiny is idle for ${interval} s`)
    })
}

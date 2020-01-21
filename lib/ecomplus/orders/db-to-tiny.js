'use strict'
const logger = require('console-files')
const getConfig = require('../../store-api/get-config')
const ecomClient = require('@ecomplus/client')
const mysql = require('../../database')
const getStores = require('../../get-stores')
const TinySchema = require('../../schemas/ecom/orders-to-tiny')
const Tiny = require('../../tiny/client')
const updateAppHiddenData = require('../../store-api/update-config')

module.exports = (appSdk) => {
  logger.log('--> Start database to tiny')

  const self = this
  self.sync = stores => {
    if (stores[self.current] && stores[self.current].store_id) {
      const store = stores[self.current]
      const storeId = store.store_id
      mysql.query('SELECT * FROM orders WHERE store_id = ? AND error = ? AND tiny_id IS NULL LIMIT 100', [storeId, 0])
        .then(rows => {
          if (rows && rows.length) {
            getConfig({ appSdk, storeId }, true)

              .then(async configObj => {
                appSdk.getAuth(storeId).then(({ myId, accessToken }) => {
                  const { access_token } = configObj
                  const tiny = new Tiny(access_token)
                  let current = 0
                  const lastSyncError = []
                  const recursiveSync = () => {
                    const orderId = rows[current] ? rows[current]._id : undefined
                    if (orderId) {
                      const url = `/orders/${orderId}.json`
                      ecomClient.store({
                        url,
                        storeId,
                        authenticationId: myId,
                        accessToken
                      })
                        .then(({ data }) => {
                          const tinySchema = TinySchema(data)
                          tiny.addOrders(tinySchema)
                            .then(response => {
                              const { retorno } = response.data
                              const { status, registros, codigo_erro, status_processamento } = retorno
                              if (retorno && parseInt(status_processamento) < 3) {
                                if (status === 'Erro') {
                                  if (!isNaN(parseInt(codigo_erro)) && parseInt(codigo_erro) === 6) {
                                    // to many requests
                                    logger.log('--> Api limit reached, waiting 1m')
                                    logger.log('--> Queue size', (rows.length - current))
                                    setTimeout(() => {
                                      // try again
                                      recursiveSync()
                                    }, 60000)
                                  } else {
                                    const { registro } = registros
                                    const { erros, codigo_erro, sequencia } = registro
                                    if (parseInt(codigo_erro) === 31) {
                                      // bad request
                                      if (erros && erros.length) {
                                        const err = {
                                          resource_id: orderId,
                                          error: erros[0].erro
                                        }
                                        lastSyncError.push(err)
                                        logger.log('--> Error:', erros[0].erro)
                                        const values = [1, storeId, data._id]
                                        mysql.query('UPDATE orders SET error = ? WHERE store_id = ? AND _id = ?', values)
                                          .then(() => logger.log('Produto com erro salvo'))
                                      }
                                      current++
                                      recursiveSync()
                                    } else if (parseInt(codigo_erro) === 30) {
                                      // duplicy
                                      // todo                       
                                      current++
                                      recursiveSync()
                                    }
                                  }
                                }
                              } else {
                                // success
                                // update tiny_id at database
                                const { registro } = registros
                                const { id } = registro
                                const orderNumber = rows[current].order_number
                                // update tiny_id of order in database
                                mysql.updateTinyIdOrder(id, orderNumber, storeId)
                                  .then(() => logger.log('-> Pedido %i enviado id atualizado para %i', orderNumber, id))
                                current++
                                recursiveSync()
                              }
                            })
                            .catch(resp => {
                              if (resp.status === 500) {
                                setTimeout(() => {
                                  recursiveSync()
                                }, 3000)
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
                    }
                  }
                  // start sync recursive
                  recursiveSync()
                })
              })
              .catch(e => logger.error('ERRR', e))
          }
        })
    }
  }

  const start = async () => {
    // current store
    self.current = 0
    // get store list
    const stores = await getStores()
    // run
    self.sync(stores)
  }

  // start
  start()

  // interval 5m
  const interval = (process.env.DB_SYNC_ORDERS_INTERVAL || 5) * 60 * 1000
  setInterval(start, interval)
}

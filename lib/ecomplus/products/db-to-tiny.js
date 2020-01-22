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
const TinySchema = require('../../schemas/ecomplus-to-tiny')

// tiny client
const Tiny = require('../../tiny/client')

// patch app
const updateAppHiddenData = require('../../store-api/update-config')

module.exports = (appSdk) => {
  logger.log('--> Running service to sent products in database tiny')

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

        mysql
          .query('SELECT * FROM products WHERE store_id = ? AND tiny_id IS NULL LIMIT 100', [storeId])

          .then(rows => {
            if (rows && rows.length) {
              return getConfig({ appSdk, storeId }, true)

                .then(async configObj => {
                  let currentProduct = 0
                  const lastSyncError = []
                  const tiny = new Tiny(configObj.access_token)

                  const recursiveSync = () => {
                    const product = rows[currentProduct]
                    const nextProduct = () => {
                      currentProduct++
                      return recursiveSync()
                    }

                    if (product) {
                      const url = `/products/${product.ecomplus_id}.json`

                      ecomClient
                        .store({ url, storeId })

                        .then(({ data }) => {
                          const tinySchema = TinySchema(data, product.id)
                          return { data, tinySchema }
                        })

                        .then(({ data, tinySchema }) => {
                          return tiny
                            .addProducts(tinySchema)

                            .then(response => {
                              const { retorno } = response.data
                              const { registros } = retorno
                              // handler tiny-api errors
                              if (retorno && parseInt(retorno.status_processamento) < 3) {
                                if (retorno.status === 'Erro') {
                                  if (!isNaN(parseInt(retorno.codigo_erro)) && parseInt(retorno.codigo_erro) === 6) {
                                    // to many requests
                                    logger.log(`--> Api limit reached, waiting 1m | Queue size: ${(rows.length - currentProduct)}`)
                                    setTimeout(() => {
                                      // wait 1m and try try again
                                      recursiveSync()
                                    }, 60000)
                                  } else {
                                    const { registro } = registros[0]
                                    const { erros, sequencia } = registro

                                    if (parseInt(registro.codigo_erro) === 31) {
                                      // bad request
                                      if (erros && erros.length) {
                                        const err = {
                                          resource_id: product.ecomplus_id,
                                          error: erros[0].erro
                                        }
                                        lastSyncError.push(err)
                                        logger.log(`[!!] Produto ${product.ecomplus_id} não enviado ao tiny devido erro em seu cadastro ->> ${erros[0].erro}`)
                                      }
                                      // next product
                                      nextProduct()
                                    } else if (parseInt(registro.codigo_erro) === 30) {
                                      // product already exists in tiny
                                      // just need to update id in the database
                                      return tiny
                                        .findProduct(data.sku)

                                        .then(result => {
                                          const { retorno } = result.data
                                          const { produtos } = retorno
                                          if (parseInt(retorno.status_processamento) === 3 && produtos.length) {
                                            const { produto } = produtos[0]
                                            mysql.updateTinyIdProduct(sequencia, produto.id)
                                              .then(() => {
                                                logger.log(`--> Produto ${data.name} existente no tiny, vinculando ID para ${produto.id}`)
                                              })
                                          }
                                          nextProduct()
                                        })
                                    }
                                  }
                                }
                              } else {
                                // success
                                // update tiny_id at database
                                const { registro } = registros[0]
                                const { sequencia, id } = registro
                                mysql.updateTinyIdProduct(sequencia, id)
                                  .then(() => {
                                    logger.log(`Produto ${data.name} enviado com sucesso, vinculando ao ID ${id}`)
                                  })
                                nextProduct()
                              }
                            })

                            .catch(resp => {
                              if (resp.status === 500) {
                                setTimeout(() => {
                                  recursiveSync()
                                }, 3000)
                              } else {
                                nextProduct()
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
                            products: lastSyncError
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

                .catch(e => logger.error('PRODUCTS_DB_TO_TINY_ERR', e))
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
      const interval = (process.env.TRACKING_SERVICE_INTERVAL || 5) * 60 * 1000
      setTimeout(() => {
        return save()
      }, interval)
      logger.log(`--> Sent products to tiny is idle for ${interval} s`)
    })
}

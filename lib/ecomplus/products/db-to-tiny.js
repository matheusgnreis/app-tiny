'use strict'
const logger = require('console-files')
const getConfig = require('../../store-api/get-config')
const ecomClient = require('@ecomplus/client')
const mysql = require('../../database')
const getStores = require('../../get-stores')
const TinySchema = require('../../schemas/ecomplus-to-tiny')
const Tiny = require('../../tiny/client')
const updateAppHiddenData = require('../../store-api/update-config')

module.exports = (appSdk) => {
  logger.log('--> Start database to tiny')

  const self = this
  self.sync = stores => {
    if (stores[self.current] && stores[self.current].store_id) {
      const store = stores[self.current]
      const storeId = store.store_id
      mysql.query('SELECT * FROM products WHERE store_id = ? AND tiny_id IS NULL LIMIT 100', [storeId])
        .then(rows => {
          if (rows && rows.length) {
            getConfig({ appSdk, storeId }, true)

              .then(async configObj => {
                const { access_token } = configObj
                const tiny = new Tiny(access_token)
                let current = 0
                const lastSyncError = []
                const recursiveSync = () => {
                  const productId = rows[current] ? rows[current].ecomplus_id : undefined
                  if (productId) {
                    const url = `/products/${productId}.json`
                    ecomClient.store({ url, storeId })
                      .then(({ data }) => {
                        const tinySchema = TinySchema(data, rows[current].id)
                        tiny.addProducts(tinySchema)
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
                                  const { registro } = registros[0]
                                  const { erros, codigo_erro, sequencia } = registro
                                  if (parseInt(codigo_erro) === 31) {
                                    // bad request
                                    if (erros && erros.length) {
                                      const err = {
                                        resource_id: productId,
                                        error: erros[0].erro
                                      }
                                      lastSyncError.push(err)
                                      logger.error('--> Error:', erros[0].erro)
                                    }
                                    current++
                                    recursiveSync()
                                  } else if (parseInt(codigo_erro) === 30) {
                                    // duplicy
                                    // todo
                                    tiny.findProduct(data.sku)
                                      .then(result => {
                                        const { retorno } = result.data
                                        const { produtos, status_processamento } = retorno
                                        if (parseInt(status_processamento) === 3 && produtos.length) {
                                          const { produto } = produtos[0]
                                          mysql.updateTinyIdProduct(sequencia, produto.id)
                                            .then(() => {
                                              logger.log('--> Produto %s ja existia no tiny \n--> tiny_id atualizado para %i', data.name, produto.id)
                                              current++
                                              recursiveSync()
                                            })
                                        }
                                      })
                                      .catch(e => logger.error(e))
                                    current++
                                    recursiveSync()
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
                                  logger.log('--> Produto %s enviado com sucesso \n-->tiny_id atualizado para %i', data.name, id)
                                  current++
                                  recursiveSync()
                                })
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
                          products: lastSyncError
                        }
                      }
                      updateAppHiddenData(appSdk, storeId, configObj, body)
                    }
                  }
                }
                // start sync recursive
                recursiveSync()
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
  const interval = (process.env.DB_SYNC_PRODUCTS_INTERVAL || 5) * 60 * 1000
  setInterval(start, interval)
}

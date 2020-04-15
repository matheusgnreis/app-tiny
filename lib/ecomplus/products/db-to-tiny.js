'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// mysql abstract
const mysql = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// get stores
const MapStores = require('./../../map-stores')

// parse to tiny schema
const TinySchema = require('../../schemas/ecomplus-to-tiny')

// tiny client
const Tiny = require('../../tiny/client')

// tiny response handler
const respHandler = require('./../../tiny/resp-handler')

module.exports = (appSdk) => {
  logger.log('--> Products to Tiny')

  const save = () => new Promise((resolve, reject) => {
    getStores()
      .then(stores => {
        const mp = new MapStores(appSdk)
        mp.tasks(stores, function (configObj, storeId, next, current, err) {
          let retry = 0
          if (!err && storeId) {
            if (!configObj.sync || !configObj.sync.ecom || !configObj.sync.ecom.products || !configObj.access_token) {
              return next() // next store
            }

            const tiny = new Tiny(configObj.access_token)

            let index = 0
            let success = 0
            let syncErrors = []

            const getProducts = () => mysql
              .query('SELECT * FROM products WHERE store_id = ? AND error = ? AND tiny_id IS NULL LIMIT 100', [storeId, 0])

            const sync = (list) => {
              const nextProd = () => {
                index++
                return sync(list)
              }

              if (!list || !list[index] || !list[index].id) {
                let fn = null
                const lastSync = {
                  sync: 'products',
                  date: new Date(),
                  storeId,
                  total: list.length,
                  success,
                  errosCount: syncErrors.length
                }

                if (list.length) {
                  logger.log('--> SYNC', JSON.stringify(lastSync, undefined, 4))
                }

                if (syncErrors.length) {
                  lastSync.errors = syncErrors
                  syncErrors = []
                  fn = () => require('./../../store-api/update-config')(appSdk, storeId, configObj.application_id)(lastSync)
                }

                return next(fn)
              }

              const product = list[index]

              const url = `/products/${product.ecomplus_id}.json`

              ecomClient
                .store({ url, storeId })

                .then(({ data }) => {
                  const schema = TinySchema(data, product.id)
                  return { data, schema }
                })

                .then(({ data, schema }) => {
                  return tiny.addProducts(schema).then(resp => ({ resp, data }))
                })

                .then(({ resp, data }) => {
                  const response = respHandler(resp)
                  const { registro } = response
                  if (response.success) {
                    // update tiny in db
                    mysql.updateTinyIdProduct(registro.sequencia, registro.id)
                    success++
                    nextProd()
                  } else if (response.error && !response.success) {
                    const { erro } = response.error
                    if (erro.code === 4290) {
                      /* to many */
                      setTimeout(() => sync(list), 1 * 60 * 1000)
                    } else if (erro.code === 4000) {
                      /* bad request */
                      // update to preventing to sync again with error in body
                      mysql.query('UPDATE products SET error = ?, updated_at = CURRENT_TIMESTAMP() WHERE ecomplus_id = ?', [1, product.ecomplus_id])
                      syncErrors.push({
                        type: 'products',
                        erro,
                        resource_id: product.ecomplus_id,
                        sku: data.sku,
                        date: new Date().toISOString()
                      })
                      nextProd()
                    } else if (erro.code === 3000) {
                      /* duplicated */
                      tiny.findProduct(data.sku)
                        .then(result => {
                          const resp = respHandler(result)
                          const { produto } = resp
                          // update db with id
                          // update db with id
                          if (resp.success) {
                            success++
                            return mysql.updateTinyIdProduct(produto.id, product.id)
                          } else if (resp.error && resp.error.erro && resp.error.erro.code === 4290) {
                            setTimeout(() => sync(list), 1 * 60 * 1000)
                          } else if (resp.error && resp.error.erro && resp.error.erro.code === 4004) {
                            // duplicated product in ecomplus
                            // update db and update hidden_data with duplicated infor
                            // and update product hidden_metafields
                            mysql.query('UPDATE products SET error = ?, updated_at = CURRENT_TIMESTAMP() WHERE ecomplus_id = ?', [1, product.ecomplus_id])
                            appSdk.apiRequest(storeId, url, 'patch', { notes: 'Produto em duplicidade, SKU não sincronizado ao TINY' })
                          }
                        }).then(() => nextProd())
                    }
                  }
                })

                .catch(err => {
                  if (err.response && err.response.status >= 500) {
                    if (retry <= 4) {
                      setTimeout(() => {
                        current()
                      }, 3000)
                      retry++
                    } else {
                      next()
                    }
                  } else {
                    next()
                  }
                })
            }

            getProducts()
              .then(list => {
                if (list && list.length) {
                  logger.log(`--> Sending ${list.length} products to the bling | store #${storeId}`)
                }
                sync(list)
              })
              .catch(() => next())
          } else if (err && storeId) {
            return next()
          } else if (!next && !err && !storeId && !configObj) {
            resolve()
          }
        })
      })
      .catch(reject)
  })

  const start = () => save().finally(() => setTimeout(() => start(), 2 * 90 * 1000))
  // start after 30s
  setTimeout(() => start(), 1 * 80 * 1000)
}

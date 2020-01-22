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

module.exports = (appSdk) => {
  logger.log('--> Running service to save products in database')

  const start = () => new Promise(async resolve => {
    let currentStore = 0
    const stores = await getStores()

    const task = async () => {
      if (stores[currentStore] && stores[currentStore].store_id) {
        const store = stores[currentStore]
        const storeId = store.store_id
        let count = 0
        const nextStore = () => {
          currentStore++
          return task()
        }

        getConfig({ appSdk, storeId: storeId }, true)

          .then(async configObj => {
            const { sync, unwatched } = configObj
            if (sync && sync.ecom && sync.ecom.products && configObj.access_token) {

              ecomClient
                .store({ url: '/products.json', storeId })

                .then(({ data }) => {
                  const promises = []
                  const { result } = data
                  if (result && result.length) {
                    for (let i = 0; i < result.length; i++) {
                      if (!unwatched || unwatched.indexOf(result[i]._id) === -1) {
                        const url = `/products/${result[i]._id}.json`
                        const promise = ecomClient
                          .store({ url, storeId })

                          .then(({ data }) => data)

                          .then(data => {
                            return mysql
                              .fetchProduct(data.sku, storeId)
                              .then(row => {
                                if (!row.length) {
                                  const { sku, _id, name, price, quantity, variations } = data
                                  return mysql
                                    .insertProduct(sku, storeId, _id, null, name, price, quantity)
                                    .then(() => {
                                      if (variations) {
                                        mysql.insertVariations(variations, _id, sku, storeId)
                                      }
                                      count++
                                    })
                                }
                              })
                          })
                        promises.push(promise)
                      }
                    }
                    return Promise.all(promises).then(() => {
                      if (count > 0) {
                        logger.log(`Save ${count} products in database for store #${storeId}`)
                      }
                    })
                  }
                })
            } else {
              nextStore()
            }
          })

          .catch(e => logger.error('PRODUCTS_TO_DB_ERR', e))

      } else {
        resolve()
      }
    }

    task()
  })

  start()
    .then(() => {
      const interval = (process.env.ECOM_SYNC_PRODUCTS_INTERVAL || 5) * 60 * 1000
      setTimeout(() => {
        return start()
      }, interval)
      logger.log(`--> Save products in database is idle for ${interval} s`)
    })
}

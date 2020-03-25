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

module.exports = (appSdk) => {
  logger.log('--> Save Products')

  const save = () => new Promise((resolve, reject) => {
    getStores()
      .then(stores => {
        const mp = new MapStores(appSdk)
        mp.tasks(stores, function (configObj, storeId, next, current, err) {
          if ((!err && storeId)) {
            const { sync, unwatched } = configObj
            if (sync && sync.ecom && sync.ecom.products && sync.ecom.products === true) {
              let retry = 0

              ecomClient
                .store({ url: '/products.json', storeId })

                .then(response => {
                  let count = 0
                  const promises = []
                  const { result } = response.data

                  if (result && result.length) {
                    const fails = []
                    for (let i = 0; i < result.length; i++) {
                      const productId = result[i]._id
                      if (!unwatched || unwatched.indexOf(productId) === -1) {
                        const url = `/products/${productId}.json`
                        const promise = ecomClient
                          .store({ url, storeId })

                          .then(({ data }) => {
                            return mysql.fetchProduct(data.sku, storeId).then(row => ({ data, row }))
                          })

                          .then(({ data, row }) => {
                            if (!row || !row.length) {
                              const { sku, _id, name, price, quantity } = data
                              mysql.insertProduct(sku, storeId, _id, null, name, price, quantity)
                              count++
                            }
                            return data
                          })

                          .then(data => {
                            if (data && data.variations) {
                              mysql.insertVariations(data.variations, data._id, data.sku, storeId)
                            }
                          })

                          .catch(err => {
                            if (err.response && err.response.status >= 500) {
                              fails.push(promise)
                            }
                          })

                        promises.push(promise)
                      }
                    }

                    Promise
                      .all(promises)
                      .then(() => {
                        if (count > 0) {
                          logger.log(`Save ${count} products | #${storeId}`)
                        }
                        next(Promise.all(fails))
                      })
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
            } else {
              next()
            }
          } else if (err && storeId) {
            return next()
          } else if (!next && !err && !storeId && !configObj) {
            resolve()
          }
        })
      })
      .catch(reject)
  })

  const start = () => save().finally(() => {
    const interval = 5 * 60 * 1000
    setTimeout(() => {
      start()
    }, interval)
  })

  setTimeout(() => { start() }, 30 * 1000)
}

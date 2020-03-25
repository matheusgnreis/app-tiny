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

const TinySituacao = require('../../schemas/tiny-status')

module.exports = appSdk => {
  logger.log('--> Order to bling')
  const save = () => new Promise((resolve, reject) => {
    getStores()
      .then(stores => {
        const mp = new MapStores(appSdk)
        mp.tasks(stores, function (configObj, storeId, next, current, err) {
          let retry = 0
          if (!err && storeId) {
            if (!configObj.sync && !configObj.sync.ecom && !configObj.sync.ecom.orders && !configObj.access_token) {
              return next() // next store
            }

            appSdk
              .getAuth(storeId)

              .then(({ myId, accessToken }) => {
                const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'
                const url = `/orders.json?fields=${fields}`
                return ecomClient
                  .store({
                    url,
                    storeId,
                    authenticationId: myId,
                    accessToken
                  })

                  .then(({ data }) => {
                    let count = 0
                    const { result } = data
                    const promises = []
                    for (let i = 0; i < result.length; i++) {
                      const promise = mysql
                        .fetchOrders(result[i]._id, storeId)
                        .then(row => {
                          if (!row || !row.length) {
                            const current = result[i].financial_status ? result[i].financial_status.current : null
                            return mysql.insertOrders(storeId, result[i]._id, current, TinySituacao(current), result[i].number, null, 'ecomplus').then(() => count++)
                          }
                        })

                      promises.push(promise)
                    }

                    Promise.all(promises).then(() => {
                      if (count > 0) {
                        logger.log(`Save ${count} orders in database for store #${storeId}`)
                      }
                      next()
                    })
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

  const start = () => save().finally(() => {
    const interval = 2 * 60 * 1000
    setTimeout(() => {
      start()
    }, interval)
  })

  setTimeout(() => { start() }, 1 * 60 * 1000)
}

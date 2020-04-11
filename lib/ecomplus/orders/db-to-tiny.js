'use strict'
// logger
const logger = require('console-files')

// ecomClinet
const ecomClient = require('@ecomplus/client')

// mysql abstract
const mysql = require('../../database')

// get instances of stores
const getStores = require('../../get-stores')

// parse to tiny schema
const TinySchema = require('../../schemas/ecom/orders-to-tiny')

// get stores
const MapStores = require('./../../map-stores')

// tiny client
const Tiny = require('../../tiny/client')

// tiny response handler
const respHandler = require('./../../tiny/resp-handler')

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

            let index = 0
            let success = 0
            let syncErrors = []
            const tiny = new Tiny(configObj.access_token)

            const getOrders = () => mysql
              .query('SELECT * FROM orders WHERE store_id = ? AND error = ? AND tiny_id IS NULL ORDER BY order_number DESC LIMIT 100 ', [storeId, 0])

            const sync = (list, myId, accessToken) => {
              const nextOrder = () => {
                index++
                return sync(list, myId, accessToken)
              }

              if (!list || !list[index] || !list[index]._id) {
                let fn = null
                const lastSync = {
                  sync: 'orders',
                  date: new Date(),
                  storeId,
                  total: list.length,
                  success,
                  errosCount: syncErrors.length
                }

                if (syncErrors.length) {
                  lastSync.errors = syncErrors
                  fn = () => require('./../../store-api/update-config')(appSdk, storeId, configObj.application_id)(lastSync)
                }

                if (list.length) {
                  delete lastSync.errors
                  logger.log('--> SYNC', JSON.stringify(lastSync, undefined, 4))
                }

                syncErrors = []
                return next(fn)
              }

              const order = list[index]

              const url = `/orders/${order._id}.json`
              ecomClient
                .store({
                  url,
                  storeId,
                  authenticationId: myId,
                  accessToken
                })

                .then(({ data }) => {
                  const schema = TinySchema(data)
                  return { data, schema }
                })

                .then(({ data, schema }) => {
                  return tiny.addOrders(schema).then(resp => ({ resp, data }))
                })

                .then(({ resp, data }) => {
                  const response = respHandler(resp)
                  const { registro } = response

                  if (response.success) {
                    mysql.updateTinyIdOrder(registro.id, order.order_number, storeId)
                    success++
                    nextOrder()
                    // update tiny in db
                  } else if (response.error && !response.success) {
                    const { erro } = response.error
                    if (erro.code === 4290) {
                      /* to many */
                      setTimeout(() => sync(list, myId, accessToken), 1 * 60 * 1000)
                    } else if (erro.code === 4000) {
                      /* bad request */
                      // update to preventing to sync again with error in body
                      mysql.query('UPDATE orders SET error = ? WHERE _id = ?', [1, data._id])
                      syncErrors.push({
                        type: 'orders',
                        erro,
                        resource_id: order.id,
                        sku: data.sku,
                        date: new Date().toISOString()
                      })
                      nextOrder()
                    } else if (erro.code === 3000) {
                      /* duplicated */
                      tiny
                        .findOrderByNumber(data.number)
                        .then(result => {
                          const resp = respHandler(result)
                          const { pedido } = resp
                          // update db with id
                          if (resp.success) {
                            success++
                            return mysql.updateTinyIdOrder(pedido.id, data.number, storeId)
                          } else if (resp.error && resp.error.erro && resp.error.erro.code === 4290) {
                            setTimeout(() => sync(list, myId, accessToken), 1 * 60 * 1000)
                          }
                        })
                        .then(() => nextOrder())
                    }
                  }
                })

                .catch(err => {
                  if (err.response && err.response.status >= 500) {
                    if (retry <= 4) {
                      setTimeout(() => {
                        return sync(list, myId, accessToken)
                      }, 3000)
                      retry++
                    } else {
                      nextOrder()
                    }
                  } else {
                    logger.error(err.message)
                    nextOrder()
                  }
                })
            }

            appSdk
              .getAuth(storeId)
              .then(({ myId, accessToken }) => {
                return getOrders()
                  .then(list => ({ myId, accessToken, list }))
              })
              .then(({ myId, accessToken, list }) => {
                if (list && list.length) {
                  logger.log(`Sending ${list.length} orders to the bling | store #${storeId}`)
                }
                sync(list, myId, accessToken)
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

  const start = () => save().finally(() => setTimeout(() => start(), 2 * 60 * 1000))
  // start after 30s
  setTimeout(() => start(), 1 * 60 * 1000)
}

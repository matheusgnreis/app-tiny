const logger = require('console-files')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const ecomClient = require('@ecomplus/client')
const mysql = require('../../database')
const getStores = require('../../get-stores')
const TinySituacao = require('../../schemas/tiny-status')

module.exports = (appSdk) => {
  logger.log('--> Running service to save orders in database')

  const start = async () => new Promise(async resolve => {
    let currentStore = 0
    const stores = await getStores()

    const task = async () => {
      if (stores[currentStore] && stores[currentStore].store_id) {
        let count = 0
        const store = stores[currentStore]
        const storeId = store.store_id

        const nextStore = () => {
          currentStore++
          return task()
        }

        getConfig({ appSdk, storeId }, true)

          .then(async configObj => {
            const { sync } = configObj

            if (sync && sync.ecom && sync.ecom.orders && configObj.access_token) {
              return appSdk
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
                        nextStore()
                      })
                    })
                })
            } else {
              nextStore()
            }
          })

          .catch(err => {
            if (!err.appAuthRemoved && (!err.response || err.response.status !== 401)) {
              logger.error('ORDERS_TO_DB_ERR', err)
            }
            nextStore()
          })
      } else {
        resolve()
      }
    }

    task()
  })

  const job = () => start()
    .finally(() => {
      const interval = (process.env.SYNC_ORDERS_TO_DB || 3) * 60 * 1000
      setTimeout(() => {
        job()
      }, interval)
    })

  job()
}

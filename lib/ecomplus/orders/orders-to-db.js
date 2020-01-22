const logger = require('console-files')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const ecomClient = require('@ecomplus/client')
const mysql = require('../../database')
const getStores = require('../../get-stores')
const TinySituacao = require('../../schemas/tiny-status')

module.exports = (appSdk) => {
  logger.log('--> Running service to save orders in database')

  const start = () => new Promise(async resolve => {
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
                  ecomClient
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
                            const current = result[i].financial_status ? result[i].financial_status.current : null
                            if (!row || !row.length) {
                              return mysql.insertOrders(storeId, result[i]._id, current, TinySituacao(current), result[i].number, null, 'ecomplus').then(() => count++)
                            } else {
                              // TODO
                              /* // verifica se o status são e atualiza no tiny e no db
                              if (row[0].ecom_status !== current) {
                                return mysql.updateSituacao('ecom_status', storeId, _id, current, 'ecomplus')
                                  .then(() => {
                                    if (row[0].tiny_status !== TinySituacao(current)) {
                                      const tiny = new Tiny(access_token)
                                      tiny.updateSituacao(row[0].tiny_id, TinySituacao(current))
                                        .then(() => mysql.updateSituacao('tiny_status', storeId, _id, TinySituacao(current), 'tiny'))
                                        .then(() => logger.log('Situação atualizada'))
                                    }
                                  })
                              } */
                            }
                          })

                        promises.push(promise)
                      }

                      Promise.all(promises).then(() => {
                        if (count > 0) {
                          logger.log(`Save ${count} orders in database for store #${storeId}`)
                        }
                      })
                    })
                })
            } else {
              nextStore()
            }
          })

          .catch(e => logger.error('ORDERS_TO_DB_ERR', e))
      } else {
        resolve()
      }
    }

    task()
  })

  start()
    .then(() => {
      const interval = (process.env.DB_SYNC_ORDERS_INTERVAL || 7) * 60 * 1000
      setTimeout(() => {
        return start()
      }, interval)
      logger.log(`--> Save orders in db is idle for ${interval} s`)
    })
}

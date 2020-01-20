const logger = require('console-files')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const ecomClient = require('@ecomplus/client')
const mysql = require('../../database')
const getStores = require('../../get-stores')
const TinySituacao = require('../../schemas/tiny-status')
const Tiny = require('../../tiny/client')

module.exports = (appSdk) => {
  logger.log('--> Start ecomplus watcher')

  const self = this

  self.sync = stores => {
    if (stores[self.current] && stores[self.current].store_id) {
      const store = stores[self.current]
      const storeId = store.store_id
      getConfig({ appSdk, storeId: storeId }, true)

        .then(async configObj => {
          const { sync, access_token } = configObj
          if (sync && sync.ecom && sync.ecom.orders) {
            appSdk.getAuth(storeId)

              .then(({ myId, accessToken }) => {
                const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'
                const url = `/orders.json?fields=${fields}`
                ecomClient.store({
                  url,
                  storeId,
                  authenticationId: myId,
                  accessToken
                })
                  .then(({ data }) => {
                    const { result } = data
                    const promises = []
                    for (let i = 0; i < result.length; i++) {
                      const promise = mysql.fetchOrders(result[i]._id, storeId)
                        .then(row => {
                          const { _id, financial_status, number } = result[i]
                          const current = financial_status ? financial_status.current : null
                          if (!row || !row.length) {
                            return mysql.insertOrders(storeId, _id, current, TinySituacao(current), number, null, 'ecomplus')
                          } else {
                            // verifica se o status são e atualiza no tiny e no db
                            if (row[0].ecom_status !== current) {
                              return mysql.updateSituacao('ecom_status', storeId, _id, current, 'ecomplus')
                                .then(() => {
                                  if (row[0].tiny_status !== TinySituacao(current)) {
                                    const tiny = new Tiny(access_token)
                                    tiny.updateSituacao(row[0].tiny_id, TinySituacao(current))
                                      .then(() => mysql.updateSituacao('tiny_status', storeId, _id, TinySituacao(current), 'tiny'))
                                      .then(() => console.log('Situação atualizada'))
                                  }
                                })
                            }
                          }
                        })

                      promises.push(promise)
                    }

                    Promise.all(promises).then(() => console.log('Orders salvas no banco.'))
                  })
              })
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
  const interval = process.env.ECOM_SYNC_PRODUCTS_INTERVAL || 5 * 60 * 1000
  setInterval(start, interval)
}

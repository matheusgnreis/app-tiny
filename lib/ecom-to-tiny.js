const logger = require('console-files')
const Tiny = require('./tiny/client')
const syncTransaction = require('./sync-transactions')
// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

module.exports = async function ({ appSdk, db }) {
  logger.log('--> Start ecomplus watcher')

  // pick up stores
  const getStores = () => {
    return new Promise((resolve, reject) => {
      const query = 'SELECT store_id FROM ecomplus_app_auth ORDER BY created_at DESC LIMIT 1'
      db.all(query, (err, rows) => {
        if (err) {
          reject(new Error(err.message))
        }
        resolve(rows)
      })
    })
  }

  const self = this

  self.sync = stores => {
    const store = stores[self.current]
    if (store && store.store_id) {
      getConfig({ appSdk, storeId: store.store_id }, true)

        .then(async configObj => {
          const { sync } = configObj
          const tiny = new Tiny(configObj.access_token)

          let transactions = []
          // checks if products are enabled to sync
          if (sync && sync.ecom && sync.ecom.products) {
            const products = await require('./ecomplus/products-to-tiny')(store.store_id, null, configObj)
            transactions = [...transactions, ...products]
          }

          // checks if orders are enabled to sync
          if (sync && sync.ecom && sync.ecom.orders) {
            const orders = await require('./ecomplus/orders-to-tiny')(tiny, appSdk, store.store_id)
            transactions = [...transactions, ...orders]
          }

          // sync?
          if (transactions) {
            syncTransaction(configObj, transactions)
              .then(() => {
                // call next store
                self.current++
                self.sync(stores)
              })
          }
        })

        .catch(e => logger.error('_GET_APP_CONFIG_ERR', e))
    } else {
      logger.log('END')
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
  const interval = 5 * 60 * 1000
  setInterval(start, interval)
}

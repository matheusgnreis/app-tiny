const logger = require('console-files')
const Tiny = require('./tiny/client')
const syncTransaction = require('./sync-transactions')
// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

module.exports = async function ({ appSdk, db }) {
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
  self.current = 0

  const stores = await getStores()

  self.sync = stores => {
    const store = stores[self.current]
    if (store && store.store_id) {
      getConfig({ appSdk, storeId: store.store_id }, true)

        .then(async configObj => {
          const { sync, access_token } = configObj
          const tiny = new Tiny(access_token)

          let transactions = []
          // verifica se os produtos estão habilitados para sincronização
          if (sync && sync.ecom && sync.ecom.products) {
            const products = await require('./ecomplus/products-to-tiny')(tiny, store.store_id)
            transactions = [...transactions, ...products]
          }

          // verifica se os pedidos estão habilitados para sincronização
          if (sync && sync.ecom && sync.ecom.orders) {
            // verifica pedidos
            const orders = await require('./ecomplus/orders-to-tiny')(tiny, appSdk, store.store_id)
            transactions = [...transactions, ...orders]
          }

          // sync?
          if (transactions) {
            syncTransaction(configObj, transactions)
              .then(() => {
                self.current++
                self.sync(stores)
              })
          }
        })

        .catch(e => logger.error('SYNC_ERR', e))
    } else {
      console.log('END')
    }
  }

  // run
  self.sync(stores)
}

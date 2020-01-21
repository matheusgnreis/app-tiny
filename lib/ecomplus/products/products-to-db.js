const logger = require('console-files')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const ecomClient = require('@ecomplus/client')
const mysql = require('../../database')
const getStores = require('../../get-stores')

module.exports = (appSdk) => {
  logger.log('--> Start ecomplus watcher')

  const self = this

  self.sync = stores => {
    if (stores[self.current] && stores[self.current].store_id) {
      const store = stores[self.current]
      const storeId = store.store_id
      getConfig({ appSdk, storeId: storeId }, true)

        .then(async configObj => {
          const { sync, unwatched } = configObj
          if (sync && sync.ecom && sync.ecom.products) {

            ecomClient
              .store({ url: '/products.json', storeId })
              .then(({ data }) => {
                const promises = []
                const { result } = data
                if (result && result.length) {
                  for (let i = 0; i < result.length; i++) {
                    if (!unwatched || unwatched.indexOf(result[i]._id) === -1) {
                      const url = `/products/${result[i]._id}.json`
                      const promise = ecomClient.store({ url, storeId })
                        .then(({ data }) => mysql.fetchProduct(data.sku, storeId)
                          .then(row => {
                            if (!row.length) {
                              const { sku, _id, name, price, quantity, variations } = data
                              mysql.insertProduct(sku, storeId, _id, null, name, price, quantity)
                                .then(() => {
                                  if (variations) {
                                    mysql.insertVariations(variations, _id, sku, storeId)
                                  }
                                })
                                .catch(err => logger.error(err.message))
                            }
                          })
                        )
                      promises.push(promise)
                    }
                  }
                  Promise.all(promises).then(() => logger.log('Produtos salvos no banco.'))
                }
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
  const interval = (process.env.ECOM_SYNC_PRODUCTS_INTERVAL || 5) * 60 * 1000
  setInterval(start, interval)
}

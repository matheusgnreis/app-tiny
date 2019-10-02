'use strict'
const logger = require('console-files')
const ecomClient = require('@ecomplus/client')
const Tiny = require('./tiny/client')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const {
  fetchProduct,
  fetchVariations,
  updateProductQty,
  updateVariations
} = require('./database')

// check products that have stock changed at tiny
// and reproduces in ecomplus API
module.exports = ({ appSdk, db }) => {
  logger.log('--> Start tiny stock watcher')

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

  // return current date
  const getPeriod = () => {
    const data = new Date()
    const year = data.getFullYear()
    const month = (`00${data.getMonth() + 1}`).slice(-2)
    const day = (`00${data.getDate()}`).slice(-2)
    return `${day}/${month}/${year}`
  }

  // this
  const self = this

  self.sync = stores => {
    const currentStore = stores[self.current]
    if (currentStore && currentStore.store_id) {
      const storeId = currentStore.store_id
      getConfig({ appSdk, storeId }, true)

        .then(configObj => {
          // tiny
          const tiny = new Tiny(configObj.access_token)

          // app auth
          appSdk.getAuth(storeId)

            .then(({ myId, accessToken }) => {

              // fetch tiny updates
              return tiny.fetchStockUpdate(getPeriod())

                .then(result => {
                  const { retorno } = result.data
                  const { produtos, status_processamento } = retorno
                  console.log(JSON.stringify(retorno))
                  // update stock?
                  if (parseInt(status_processamento) === 3) {
                    if (produtos && produtos.length) {
                      // checks if stock values are the same
                      produtos.forEach(async produto => {
                        const saldo = produto.produto.saldo
                        const sku = produto.produto.codigo
                        let promise = null
                        let update = null

                        // ecomplus config
                        const options = {
                          storeId,
                          authenticationId: myId,
                          accessToken,
                          method: 'patch',
                          data: { quantity: saldo }
                        }

                        // product?
                        let find = await fetchProduct(sku, storeId)

                        if (find && find.length) {
                          const qty = find[0].quantity || 0
                          if (qty !== saldo) {
                            options.url = `/products/${find[0].ecomplus_id}.json`
                            promise = true
                            update = updateProductQty(sku, storeId, saldo, 'tiny')
                            console.log('Quantidade do produto %s atualizada para %i', sku, saldo)
                          }
                        } else {
                          // variation?
                          find = await fetchVariations(sku, storeId)
                          const qty = find[0].quantity || 0
                          if (qty !== saldo) {
                            options.url = `/products/${find[0].parent_id}/variations/${find[0]._id}.json`
                            promise = true
                            update = updateVariations(sku, storeId, saldo, 'tiny')
                            console.log('Quantidade da variação %s atualizada %i', sku, saldo)
                          }
                        }

                        if (promise) {
                          // update ecomplus api
                          ecomClient.store(options).then(() => {
                            console.log('Estoque atualizado')
                          })
                            .then(update)
                            .catch(response => {
                              // prevent 503
                              if (response.status >= 500) {
                                setTimeout(() => {
                                  // try again
                                  promise.then(update)
                                }, 3000)
                              }
                            })
                        }
                      })
                    }
                  }
                })
            })
            .then(() => {
              // call next store
              self.current++
              self.sync(stores)
            })
        })

        .catch(e => {
          // call next store
          self.current++
          self.sync(stores)
          logger.log('GET_APP_CONFIG_ERR', e)
        })
    }
  }

  const start = async () => {
    logger.log('--> Running automatic stock control')
    // current store
    self.current = 0
    // get store list
    const stores = await getStores()
    // run
    self.sync(stores)
  }

  // start
  // start()

  // interval 5m
  const interval = 3 * 60 * 1000
  setInterval(start, interval)
}

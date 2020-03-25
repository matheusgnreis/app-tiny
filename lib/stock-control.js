'use strict'
const logger = require('console-files')
const ecomClient = require('@ecomplus/client')
const Tiny = require('./tiny/client')
const getStores = require('./get-stores')
const { fetchProduct, fetchVariations, updateProductQty, updateVariations } = require('./database')
const MapStores = require('./map-stores')
// tiny response handler
const respHandler = require('./tiny/resp-handler')

// check products that have stock changed at tiny
// and reproduces in ecomplus API
module.exports = appSdk => {
  logger.log('--> Stock Control')

  // return current date
  const getPeriod = () => {
    const data = new Date()
    const year = data.getFullYear()
    const month = (`00${data.getMonth() + 1}`).slice(-2)
    const day = (`00${data.getDate()}`).slice(-2)
    return `${day}/${month}/${year}`
  }

  const stockControll = () => new Promise((resolve, reject) => {
    const mp = new MapStores(appSdk)
    const callback = function (configObj, storeId, next, current, err) {
      if (!err && storeId) {
        const { sync } = configObj
        if (!configObj.access_token || !sync || !sync.tiny || !sync.tiny.stock || sync.tiny.stock === false) {
          return next()
        }

        const tiny = new Tiny(configObj.access_token)
        let retry = 0

        appSdk.getAuth(storeId)

          .then(({ myId, accessToken }) => {
            return tiny.fetchStockUpdate(getPeriod()).then(resp => ({ resp, myId, accessToken }))
          })

          .then(({ resp, myId, accessToken }) => {
            resp = respHandler(resp)
            return { resp, myId, accessToken }
          })

          .then(({ resp, myId, accessToken }) => {
            const { success, error, produtos } = resp
            if (success && produtos && produtos.length) {
              // update stock ecom
              produtos.forEach(async produto => {
                const { saldo, codigo } = produto
                const options = {
                  storeId,
                  authenticationId: myId,
                  accessToken,
                  method: 'patch',
                  data: {
                    quantity: saldo
                  }
                }

                // find product in db
                let result = await fetchProduct(codigo, storeId).then(row => row[0])
                // produto
                if (result) {
                  if (result.quantity !== saldo) {
                    options.url = `/products/${result.ecomplus_id}.json`
                    ecomClient
                      .store(options)
                      .catch(e => {
                        // prevent 503
                        if (e.response && e.response.status >= 500) {
                          if (retry <= 4) {
                            setTimeout(() => {
                              // try again
                              return ecomClient.store(options)
                            }, 3000)
                            retry++
                          }
                        }
                      })

                    // update db
                    updateProductQty(codigo, storeId, saldo, 'tiny')
                  }
                } else {
                  result = await fetchVariations(codigo, storeId).then(row => row[0])
                  // variação
                  if (result.quantity !== saldo) {
                    options.url = `/products/${result.parent_id}/variations/${result._id}.json`
                    ecomClient
                      .store(options)
                      .catch(e => {
                        // prevent 503
                        if (e.response && e.response.status >= 500) {
                          if (retry <= 4) {
                            setTimeout(() => {
                              // try again
                              return ecomClient.store(options)
                            }, 3000)
                            retry++
                          }
                        }
                      })
                    updateVariations(codigo, storeId, saldo, 'tiny')
                  }
                }
              })
              next()
            } else if (error && !success) {
              const { erro } = resp.error
              if (erro.code === 4290) {
                /* to many */
                setTimeout(() => current(), 1 * 60 * 1000)
              } else if (erro.code === 4004) {
                // no results
                // glow
                return next()
              }
            }
          })

          .catch(() => next())
      } else if (err && storeId) {
        // erro with appSdk or getConfig()
        // will be handle by mp.tasks()
        return next()
      } else if (!configObj && !storeId && !next && !current) {
        // no more stores, bye
        resolve()
      }
    }

    getStores()
      .then(stores => mp.tasks(stores, callback))
      .catch(reject)
  })

  const start = () => stockControll().finally(() => {
    const interval = 6 * 60 * 1000
    setTimeout(() => start(), interval)
  })

  setTimeout(() => start(), 3 * 60 * 100)
}

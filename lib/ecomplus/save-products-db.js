module.exports = ({ logger, ecomClient, mysql, getStores, MapStores, appSdk }) => {
  logger.log('>> Save products - OK')

  const save = () => new Promise(async (resolve, reject) => {
    const callback = function (configObj, storeId, next, current, err) {
      if (err && storeId) {
        logger.error('SaveProductsError', err)
        return next()
      } else if (!next && !err && !storeId && !configObj) {
        return resolve()
      }

      const { sync } = configObj
      if (
        !sync ||
        !sync.ecom ||
        !sync.ecom.products ||
        sync.ecom && sync.ecom.products === false ||
        !configObj.access_token
      ) {
        return next()
      }

      ecomClient.store({
        url: '/products.json',
        storeId
      }).then(({ data }) => {
        const { result } = data
        const promises = []
        let success = 0
        const failed = []

        result.forEach(product => {
          const url = `/products/${product._id}.json`
          const request = ecomClient.store({
            url, storeId
          }).then(({ data }) => {
            return mysql.fetchProduct(data.sku, storeId).then(row => ({ data, row }))
          }).then(({ data, row }) => {
            if (!row || !row.length) {
              const { sku, _id, name, price, quantity } = data
              mysql.insertProduct(sku, storeId, _id, null, name, price, quantity)
              success++
            }
            return data
          }).then(data => {
            if (data && data.variations) {
              mysql.insertVariations(data.variations, data._id, data.sku, storeId)
            }
          }).catch(err => {
            if (err.response && err.response.status >= 500) {
              failed.push(promise)
            }
          })

          promises.push(request)
        })

        Promise.all(promises).then(failed).then(() => {
          if (success > 0) {
            logger.log(`>> Saved ${success} products | #${storeId}`)
          }
          next()
        })
      }).catch(err => {
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
    }

    const mp = new MapStores(appSdk)
    const stores = await getStores().catch(reject)
    mp.tasks(stores, callback)
  })

  const start = () => save().finally(() => setTimeout(() => start(), 1 * 30 * 1000))
  // start after 30s
  // setTimeout(() => start(), 1 * 30 * 1000)
  start()
}
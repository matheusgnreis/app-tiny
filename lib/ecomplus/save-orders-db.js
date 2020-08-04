const parseOrderStatus = require('./../ecomplus/parse-orders-status')

module.exports = ({ logger, ecomClient, mysql, getStores, MapStores, appSdk }) => {
  logger.log('>> Save orders - OK')

  const save = () => new Promise(async (resolve, reject) => {

    const callback = function (configObj, storeId, next, current, err) {
      if (err && storeId) {
        logger.error('SaveOrdersErr', err)
        return next()
      } else if (!next && !err && !storeId && !configObj) {
        return resolve()
      }

      const { sync } = configObj
      if (
        !sync ||
        !sync.ecom ||
        !sync.ecom.orders ||
        (sync.ecom && sync.ecom.orders === false) ||
        !configObj.access_token
      ) {
        return next()
      }

      /**
       * stuffs here ✴
       */
      appSdk.getAuth(storeId).then(({ myId, accessToken }) => {
        const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'
        let success = 0

        const fetchOrders = (limit = 500, offset = 0) => {
          const url = '/orders.json?financial_status.current=paid' +
            `&fields=${fields}` +
            `&limit=${limit}` +
            `&offset=${offset}`

          ecomClient.store({
            url,
            storeId,
            authenticationId: myId,
            accessToken
          }).then(({ data }) => {
            const { result } = data
            if (result && result.length) {
              const promises = []
              result.forEach(order => {
                const promise = mysql.fetchOrders(order._id, storeId).then(row => {
                  if (!row || !row.length) {
                    const financialStatus = order.financial_status ? order.financial_status.current : null
                    return mysql.insertOrders(storeId, order._id, financialStatus, parseOrderStatus(financialStatus), order.number, null, 'ecom').then(() => success++)
                  }

                  return
                })

                promises.push(promise)
              })

              Promise.all(promises).then(() => {
                if (success > 0) {
                  logger.log(`>> Saved ${success} orders / #${storeId}`)
                }
                offset += limit
                fetchOrders(limit, offset)
              })
            } else {
              return next()
            }
          })
            .catch(err => {
              console.log(err)
              const { response } = err
              if (response && response.status >= 500) {
                setTimeout(() => {
                  return fetchOrders(limit, offset)
                }, 4000)
              }
            })
        }

        fetchOrders()
      }).catch(() => next())
    }

    const mp = new MapStores(appSdk)
    const stores = await getStores().catch(reject)
    mp.tasks(stores, callback)
  })

  const start = () => save().finally(() => setTimeout(() => start(), 2 * 60 * 1000))
  // start after 15s
  //setTimeout(() => start(), 1 * 30 * 1000)
  start()
}
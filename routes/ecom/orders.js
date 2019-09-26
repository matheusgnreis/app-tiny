'use strict'
const { store } = require('@ecomplus/client')
const Tiny = require('./../../lib/tiny/client')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const ordersToTiny = require('./../../lib/ecomplus/orders-to-tiny')
const syncTransaction = require('./../../lib/sync-transactions')

module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    const body = req.body

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        const tiny = new Tiny(configObj.access_token)
        const orders = []
        const promises = []

        for (let i = 0; i < body.length; i++) {
          const promise = appSdk.getAuth(storeId)

            .then(({ myId, accessToken }) => {
              const url = `/orders/${body[i]}.json?fields=_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions`

              return store({
                url,
                storeId,
                authenticationId: myId,
                accessToken
              })

                .then(({ data }) => { orders.push(data) })
            })

          promises.push(promise)
        }

        Promise.all(promises).then(async () => {
          const transaction = await ordersToTiny(tiny, appSdk, storeId, orders)
          syncTransaction(configObj, transaction)
        })
          .finally(() => {
            res.status(200).end()
          })
      })

      .catch(err => {
        res.status(500).send({ error: err.message })
      })
  }
}

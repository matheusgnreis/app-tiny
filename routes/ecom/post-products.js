const { store } = require('@ecomplus/client')
const productToTiny = require('./../../lib/ecomplus/products-to-tiny')
const syncTransaction = require('./../../lib/sync-transactions')
const Tiny = require('./../../lib/tiny/client')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    const body = req.body

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        const tiny = new Tiny(configObj.access_token)
        const products = []
        const promises = []

        for (let i = 0; i < body.length; i++) {
          const url = `/products/${body[i]}.json`

          const promise = store({ url, storeId }).then(({ data }) => { products.push(data) })

          promises.push(promise)
        }

        Promise.all(promises).then(async () => {
          const transaction = await productToTiny(tiny, storeId, products)
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
'use strict'
const { store } = require('@ecomplus/client')
const Tiny = require('./../../lib/tiny/client')
const TinySchema = require('./../../lib/schemas/ecomplus-to-tiny')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const productToTiny = require('./../../lib/ecomplus/products-to-tiny')
const syncTransaction = require('./../../lib/sync-transactions')
const { fetchProduct, updateProduct } = require('./../../lib/database')

module.exports = (appSdk, router) => {
  router.post('', POST(appSdk))
  router.get('/:id?.json', GET(appSdk))
  router.patch('/:id?.json', PATCH(appSdk))
  router.delete('/:id?.json', DELETE(appSdk))
  return router
}

const POST = appSdk => {
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

const GET = appSdk => {
  return (req, res) => {
  }
}

const PATCH = appSdk => {
  return (req, res) => {
    const { storeId } = req
    const body = req.body
    const { id } = req.params

    if (!body) {
      res.status(406).send({
        'status': 406,
        'message': 'Empty body received, not acceptable for this request method.',
        'user_message': {
          'en_us': 'Unexpected error, report to support or responsible developer',
          'pt_br': 'Erro inesperado, reportar ao suporte ou desenvolvedor responsável'
        }
      })
    } else if (!id) {
      res.status(406).send({
        'status': 406,
        'message': 'Invalid value on resource ID',
        'user_message': {
          'en_us': 'The informed ID is invalid',
          'pt_br': 'O ID informado é inválido'
        }
      })
    }

    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        const tiny = new Tiny(configObj.access_token)

        const url = `/products/${id}.json`
        store({ url, storeId })

          // merge
          .then(({ data }) => {
            const payload = {
              ...data,
              ...body
            }

            return fetchProduct(data.sku, storeId)
              .then(row => {

                tiny.fetchProducts(row[0].tiny_id)

                  .then(result => {

                    const { retorno } = result.data
                    const { status_processamento, produto } = retorno

                    if (parseInt(status_processamento) === 3) {
                      const schema = TinySchema(payload, row[0].id)

                      //
                      const products = {
                        ...schema,
                        ...produto
                      }

                      tiny.updateProducts(products)

                        .then(resp => {
                          const { retorno } = result.data
                          const { status_processamento } = retorno

                          if (parseInt(status_processamento) === 3) {
                            updateProduct(storeId, row[0].tiny_id, payload._id, payload.sku, payload.price, payload.name, payload.quantity)
                              .then(() => {
                                res.status(204).end()
                              })
                          } else {
                            // update database
                            res.status(400).send(resp)
                          }
                        })

                        .catch(err => {
                          res.status(500).send(err.data)
                        })
                    }
                  })
              })
          })
      })
  }
}

const DELETE = appSdk => {
  return (req, res) => {
    
  }
}

'use strict'
const { store } = require('@ecomplus/client')
const Tiny = require('./../../lib/tiny/client')
const TinySchema = require('./../../lib/schemas/ecomplus-to-tiny')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const productToTiny = require('./../../lib/ecomplus/products-to-tiny')
const syncTransaction = require('./../../lib/sync-transactions')
const { fetchProduct, getProductById, deleteProduct, updateProduct } = require('./../../lib/database')

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
    const { storeId } = req
    const { id } = req.params

    getProductById(id, storeId)

      .then(row => {
        if (row && row.length) {
          res.send(row[0])
        } else {
          res.status(404).send({
            'status': 404,
            'message': 'Not found',
            'user_message': {
              'en_us': 'No results were found for the requested resource and ID',
              'pt_br': 'Nenhum resultado foi encontrado para o recurso e ID solicitado'
            }
          })
        }
      })

      .catch(e => {
        res.status(500).send(e.message)
      })
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
    const { storeId } = req
    const { id } = req.params

    getConfig({ appSdk, storeId }, true)
      .then(configObj => {
        return getProductById(id, storeId)

          .then(row => {
            if (row && row.length) {
              // apaga no banco de dados
              return deleteProduct(id, storeId)

                .then(() => {
                  // salva no hidden data para não ser sincronizado novamente
                  const unwatched = []
                  unwatched.push(id)

                  const appUnwatched = configObj.unwatched || []
                  const body = {
                    unwatched: [
                      ...appUnwatched,
                      ...unwatched
                    ]
                  }

                  return require('../../lib/store-api/update-config')(appSdk, storeId, configObj, body)

                    .then(() => {
                      res.status(204).end()
                    })
                })

              // 204
            } else {
              res.status(404).send({
                'status': 404,
                'message': 'Resource ID on URL is invalid for this store',
                'user_message': {
                  'en_us': 'Nothing found, verify the specified ID',
                  'pt_br': 'Nada encontrado, verifique o ID especificado'
                }
              })
            }
          })
      })

      .catch(e => {
        res.status(500).send(e.message)
      })
  }
}

module.exports = (appSdk, router) => router.post('', POST(appSdk))
  .get('/:id?.json', GET(appSdk))
  .patch('/:id?.json', PATCH(appSdk))
  .delete('/:id?.json', DELETE(appSdk))

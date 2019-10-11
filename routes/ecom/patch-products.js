const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const { store } = require('@ecomplus/client')
const Tiny = require('./../../lib/tiny/client')
const { fetchProduct, updateProduct } = require('./../../lib/database')
const TinySchema = require('./../../lib/schemas/ecomplus-to-tiny')

module.exports = appSdk => {
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
                            const qty = body.quantity || 0
                            tiny.updateStock(row[0].tiny_id, qty).then(r => console.log(JSON.stringify(r)))
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

              .catch(e => {
                res.status(500).send(e)
              })
          })
      })
  }
}
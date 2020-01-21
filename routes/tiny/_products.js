const Tiny = require('./../../lib/tiny/client')
const EcomSchema = require('./../../lib/schemas/tiny-to-ecomplus')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const { insertProduct } = require('../../lib/database')
const logger = require('console-files')

module.exports = appSdk => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id'), 10)
    const body = req.body

    if (!Array.isArray(body) || body === null || !body.length) {
      return res.status(406).send('Invalid body')
    }

    getConfig({ appSdk, storeId }, true)

      .then(objConfig => {
        const { access_token } = objConfig
        const tiny = new Tiny(access_token)

        let current = 0
        const sync = (skus) => {
          const sku = skus[current]
          if (sku) {
            tiny.findProduct(sku)
              .then(async result => {
                let { retorno } = result.data
                let { status, status_processamento, produtos, codigo_erro } = retorno
                let { produto } = produtos[0]

                if (parseInt(status_processamento) === 3) {
                  return tiny.fetchProducts(produto.id)

                    .then(async result => {
                      let { retorno } = result.data
                      let { status, status_processamento, produto, codigo_erro } = retorno

                      if (parseInt(status_processamento) === 3) {
                        let schema
                        try {
                          schema = await EcomSchema(produto, tiny)
                        } catch (error) {
                          res.status(400).send(error.message)
                        }

                        const resource = '/products.json'
                        const method = 'POST'
                        return appSdk.apiRequest(storeId, resource, method, schema)

                          .then((resp) => {
                            const { _id } = resp.response.data
                            // insere produto no banco
                            insertProduct(schema.sku, storeId, _id, body[0], schema.name, schema.price, schema.quantity, 'tiny')
                            // variação?
                            if (produto.classe_produto === 'V') {
                              const setVariations = require('../../lib/variations-to-ecom')(tiny, appSdk, storeId)
                              setVariations(produto.variacoes, _id, schema.sku) // Ecomplus
                              // insere variação no banco
                            }
                            current++
                            sync(skus)
                          })
                      } else {
                        if (status === 'Erro') {
                          if (!isNaN(parseInt(codigo_erro)) && parseInt(codigo_erro) === 6) {
                            // to many requests
                            logger.log('--> API limit reached, sending the product %s in 1m', sku)
                            setTimeout(() => {
                              // try again
                              sync(body)
                            }, 60000)
                          } else {
                            logger.log('Product %i not found with this sku', sku)
                          }
                        }
                      }
                    })
                } else {
                  if (!isNaN(parseInt(codigo_erro)) && parseInt(codigo_erro) === 6) {
                    // to many requests
                    logger.log('--> API limit reached, sending the product %s in 1m', sku)
                    setTimeout(() => {
                      // try again
                      sync(body)
                    }, 60000)
                  } else {
                    logger.log('Product %i not found with this sku', sku)
                  }
                }
              })
              .catch(e => logger.log('TINY_SYNC_PRODUCTS_ERR', e))
          }
        }

        sync(body)
        res.status(200).end()
      })
  }
}

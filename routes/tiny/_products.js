const Tiny = require('./../../lib/tiny/client')
const EcomSchema = require('./../../lib/schemas/tiny-to-ecomplus')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const { insertProduct } = require('../../lib/database')
const logger = require('console-files')

module.exports = appSdk => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id'), 10) || parseInt(req.query.storeId, 10)
    const body = req.body

    if (!storeId || storeId < 100) {
      return res.status(401).send('storeId invalid')
    }

    if (!Array.isArray(body) || body === null || !body.length) {
      return res.status(406).send('Body must be a array of sku`s ["sku-1", "sku-2"]')
    }

    getConfig({ appSdk, storeId }, true)

      .then(objConfig => {
        if (objConfig.access_token) {
          let current = 0
          const tiny = new Tiny(objConfig.access_token)

          const nextProduct = () => {
            current++
            sync()
          }

          const sync = () => {
            const sku = body[current]
            if (sku) {
              tiny
                .findProduct(sku)

                .then(async result => {
                  let { retorno } = result.data

                  if (parseInt(retorno.status_processamento) === 3) {
                    let { produtos } = retorno
                    let { produto } = produtos[0]
                    return tiny
                      .fetchProducts(produto.id)
                      .then(async result => {
                        let { retorno } = result.data
                        let { produto } = retorno

                        if (parseInt(retorno.status_processamento) === 3) {
                          let schema
                          try {
                            schema = await EcomSchema(produto, tiny)
                          } catch (error) {
                            res.status(400).send(error.message)
                          }

                          const resource = '/products.json'
                          const method = 'POST'
                          return appSdk
                            .apiRequest(storeId, resource, method, schema)

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
                              nextProduct()
                            })
                        } else {
                          if (retorno.status === 'Erro') {
                            if (!isNaN(parseInt(retorno.codigo_erro)) && parseInt(retorno.codigo_erro) === 6) {
                              // to many requests
                              logger.log('--> API limit reached, sending the product %s in 1m', sku)
                              setTimeout(() => {
                                // try again
                                sync()
                              }, 60000)
                            } else {
                              logger.log(`Produto ${sku} entrando mas id não bate no tiny`)
                              nextProduct()
                            }
                          }
                        }
                      })
                  } else if (parseInt(retorno.status_processamento) === 2) {
                    // produto no found for sku
                    logger.log(`Produto ${sku} não encontrado no tiny com esse sku`)
                    nextProduct()
                  } else {

                  }
                })

                .catch(e => {
                  if (e.response && e.response.data) {
                    logger.log('TINY_SYNC_PRODUCTS_ERR', JSON.stringify(e.response.data))
                  }
                  logger.log('TINY_SYNC_PRODUCTS_ERR', e)
                })
            }
          }

          sync()
          res.status(200).end()
        } else {
          res.status(401)
          res.send({
            error: 'Unauthorized',
            mensage: 'Tiny access_token token unset at application config'
          })
        }
      })
  }
}

const Tiny = require('./../../lib/tiny/client')
const EcomSchema = require('./../../lib/schemas/tiny-to-ecomplus')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

const POST_PRODUCTS = appSdk => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id'), 10)
    const body = req.body

    getConfig({ appSdk, storeId }, true)

      .then(objConfig => {
        const { access_token } = objConfig
        const tiny = new Tiny(access_token)

        tiny.fetchProducts(body[0])

          .then(async result => {
            const { retorno } = result.data
            const { status_processamento, produto } = retorno

            if (parseInt(status_processamento) === 3) {
              let schema
              try {
                schema = await EcomSchema(produto, tiny)
              } catch (error) {
                res.status(400).send(error.message)
              }
              console.log(JSON.stringify(schema))
              const resource = '/products.json'
              const method = 'POST'
              return appSdk.apiRequest(storeId, resource, method, schema)

                .then((resp) => {
                  res.send(resp.response.data)

                  // variação?
                  if (produto.classe_produto === 'V') {
                    const { _id } = resp.response.data
                    const setVariations = require('../../lib/variations-to-ecom')(tiny, appSdk, storeId)
                    setVariations(produto.variacoes, _id)
                  }
                })

                .catch(e => console.log(JSON.stringify(e.response.data)))
            } else {
              console.log(JSON.stringify(retorno))
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
      })
  }
}

module.exports = (appSdk, router) => router.post('', POST_PRODUCTS(appSdk))

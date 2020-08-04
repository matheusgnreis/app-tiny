const newProduct = require('./../../../../lib/ecomplus/new-product')
const createVariations = require('./../../../../lib/ecomplus/create-variations')

module.exports = ({ appSdk, logger, mysql, tinyClient }) => {
  return (req, res) => {
    const body = req.body
    const storeId = req.storeId
    const appConfig = req.appConfig

    if (!body ||
      !Array.isArray(body) ||
      !body.length) {
      return res.status(406).send({
        status: 400,
        message: 'Payload precisa ser um array de sku`s'
      })
    }

    if (!appConfig.access_token) {
      return res.status(406).send({
        status: 400,
        message: 'Tiny Access Token não configurado, verifique as configurações do aplicativo em https://admin.e-com.plus'
      })
    }

    const token = appConfig.access_token
    const doSync = async (queue = 0) => {
      if (body[queue]) {
        // pesquisa produto
        tinyClient({
          url: 'produtos.pesquisa.php',
          params: {
            pesquisa: body[queue]
          },
          token,
        }, true).then(({ produtos }) => {
          // busca o body
          // do id do primeiro resultado
          return tinyClient({
            url: 'produto.obter.php',
            params: {
              id: produtos[0].id
            },
            token,
          }, true)
        }).then(({ produto }) => {
          // busca estoque do produto
          // e inclui no body do produto
          return tinyClient({
            url: 'produto.obter.estoque.php',
            params: {
              id: produto.id
            },
            token
          }, true).then(async payload => {
            produto.saldo = payload.produto.saldo
            // cria um modelo pra store-api/products.json
            const product = await newProduct(produto)
            return { product, produto }
          })
        }).then(async ({ product, produto }) => {
          // tenta criar o produto
          const url = '/products.json'
          return appSdk.apiRequest(storeId, url, 'post', product).then(({ response }) => ({ response, produto, product }))
        }).then(({ response, produto, product }) => {
          const { data } = response
          // é um produto com variações?
          if (produto.classe_produto === 'V' &&
            produto.variacoes &&
            produto.variacoes.length) {
            product._id = data._id
            // deixa as variações sendo criadas em segundo plano
            createVariations(produto, tinyClient, token, mysql, appSdk, storeId, product)
          }

          // inclui o produto no db
          // para evitar de ser sincronizado na proxima rotina
          return mysql.insertProduct(product.sku, storeId, data._id, produto.id, product.name, product.price, product.quantity, 'tiny')
        }).then(() => {
          queue++
          doSync(queue)
        }).catch(err => {
          if (err.code === 6) {
            setTimeout(() => {
              return doSync(queue)
            }, 1 * 60 * 1000)
          } else {
            console.log(err.message)
            if (err.response) {
              logger.error('UnexpectedErr', err.response)
            }
            queue++
            doSync(queue)
          }
        })
      }
    }

    doSync()

    return res.sendStatus(201).end()
  }
}

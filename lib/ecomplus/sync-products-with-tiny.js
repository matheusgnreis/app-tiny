// parse to tiny schema
const newTinyProduct = require('./../tiny/new-produto')

module.exports = ({ logger, ecomClient, mysql, getStores, MapStores, appSdk, tinyClient }) => {
  logger.log('>> Sync products - OK')

  const sync = () => new Promise(async (resolve, reject) => {
    const callback = function (configObj, storeId, next, current, err) {
      if (err && storeId) {
        return next()
      } else if (!next && !err && !storeId && !configObj) {
        return resolve()
      }

      // stuffs
      if (!configObj.access_token) {
        return next()
      }

      const token = configObj.access_token

      let retry = 0
      let syncErrors = []

      const query = 'select * from products ' +
        'where store_id = ? ' +
        'and error = ? ' +
        'and tiny_id is null ' +
        'limit 20'

      const listProductsInDB = () => mysql.query(query, [storeId, 0])

      const doSync = (listOfProducts, queue = 0, success = 0, failed = 0) => {
        const nextProduct = () => {
          queue++
          return doSync(listOfProducts, queue, success, failed)
        }

        if (!listOfProducts ||
          !listOfProducts[queue] ||
          !listOfProducts[queue].id
        ) {
          const lastSync = {
            sync: 'products',
            storeId,
            total: listOfProducts.length,
            success,
            failed,
            errors: syncErrors
          }

          let fn = null
          if (lastSync.total >= 1) {
            logger.log('<< SYNC: ', JSON.stringify(lastSync, undefined, 4))
            fn = mysql.saveSync(listOfProducts.length, success, failed, storeId, syncErrors)
              .then(() => console.log('Sincronização concluida.'))
          }
          return next(fn)
        }

        const product = listOfProducts[queue]

        const setProductWithError = () => {
          const sql = 'update products ' +
            'set error = ?, ' +
            'updated_at = CURRENT_TIMESTAMP() ' +
            'where ecomplus_id = ?'
          return mysql
            .query(sql, [1, product.ecomplus_id])
        }

        const url = `/products/${product.ecomplus_id}.json`
        ecomClient.store({ url, storeId }).then(({ data }) => {
          return newTinyProduct(data, product.id)
        })

          .then(newProduct => {
            return tinyClient({
              url: 'produto.incluir.php',
              data: JSON.stringify({
                produtos: [newProduct]
              }),
              isForm: true,
              token
            }, true)
          })

          .then(({ registro }) => {
            console.log('>> Produto enviado com sucesso:', product.sku)
            success++
            return mysql.updateTinyIdProduct(registro.sequencia, registro.id)
          })

          .then(nextProduct)

          .catch(err => {
            // store-api error?
            if (err.response && err.response.status >= 500) {
              if (retry <= 4) {
                setTimeout(() => {
                  return doSync(listOfProducts, queue, success, failed)
                }, 4000)
                retry++
              } else {
                nextProduct()
              }
            } else if (err.isTinyError) {
              const { tinyError, retorno } = err
              switch (err.code) {
                case 6:
                  console.log('<< WAIT! API LIMIT')
                  setTimeout(() => {
                    // wait 1m and try to sync current order again 🙏
                    return doSync(listOfProducts, queue, success, failed)
                  }, 1 * 60 * 1000)
                  break
                case 31:
                  failed++
                  syncErrors.push({
                    resource: 'products',
                    resource_id: product.ecomplus_id,
                    message: tinyError,
                    retorno
                  })

                  setProductWithError().then(nextProduct)
                  break
                case 30:
                  tinyClient({
                    url: 'produtos.pesquisa.php',
                    params: {
                      pesquisa: product.sku
                    },
                    token
                  }, true)

                    .then(({ produtos }) => {
                      console.log('>> Produto existente no tiny, atualizado id:', produtos[0].id)
                      success++
                      return mysql.updateTinyIdProduct(product.id, produtos[0].id)
                    })

                    .then(nextProduct)

                    .catch(error => {
                      const { retorno } = error
                      if (error.code === 6) {
                        console.log('WAIT! API LIMIT, AGAIN :(')
                        setTimeout(() => {
                          // wait 1m and try to sync current order again 🙏
                          return doSync(listOfProducts, queue, success, failed)
                        }, 1 * 60 * 1000)
                      } else {
                        failed++
                        // push erro to array of erros
                        syncErrors.push({
                          resource: 'products',
                          resource_id: product.ecomplus_id,
                          message: tinyError,
                          retorno
                        })     

                        setProductWithError()

                        appSdk
                          .apiRequest(storeId, url, 'patch', {
                            notes: 'SKU em duplicidade, produto não sincronizado para Tiny'
                          })
                          .then(nextProduct)
                      }
                    })
                  break
                default:
                  nextProduct()
                  break
              }
            } else {
              logger.error(`Erro com o produto ${product.sku}, da loja ${storeId}: `, err.response || err.message)
              setProductWithError()
              nextProduct()
            }
          })
      }

      listProductsInDB()
        .then(listOfProducts => {
          if (listOfProducts && listOfProducts.length) {
            logger.log(`<< Sync ${listOfProducts.length} products with Tiny | store #${storeId}`)
          }
          return doSync(listOfProducts)
        }).catch(next)
    }

    const mp = new MapStores(appSdk)
    const stores = await getStores().catch(reject)
    mp.tasks(stores, callback)
  })

  const start = () => sync().finally(() => setTimeout(() => start(), 2 * 30 * 1000))
  // start after 30s
  //setTimeout(() => start(), 1 * 80 * 1000)
  start()
}
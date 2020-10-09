const getCurrentDate = () => {
  const data = new Date()
  const year = data.getFullYear()
  const month = (`00${data.getMonth() + 1}`).slice(-2)
  const day = (`00${data.getDate()}`).slice(-2)
  return `${day}/${month}/${year}`
}

module.exports = ({ logger, ecomClient, mysql, getStores, MapStores, appSdk, tinyClient }) => {
  logger.log('>> Stock Manager - OK')

  const manager = () => {
    return new Promise(async (resolve, reject) => {
      const callback = async function (configObj, storeId, next, current, err) {
        if (err && storeId) {
          return next()
        } else if (!next && !err && !storeId && !configObj) {
          return resolve()
        }

        // stuffs
        if (
          !configObj.access_token ||
          !configObj.sync ||
          !configObj.sync.tiny ||
          !configObj.sync.tiny.stock ||
          configObj.sync.tiny.stock === false
        ) {
          return next()
        }

        const token = configObj.access_token

        await tinyClient({
          url: 'lista.atualizacoes.estoque',
          params: {
            dataAlteracao: getCurrentDate()
          },
          token
        }, true).then(({ produtos }) => {
          const promises = []
          for (let i = 0; i < produtos.length; i++) {
            const { codigo, saldo } = produtos[i]
            const promise = mysql.fetchProduct(codigo, storeId).then(async row => {
              // alterou o produto
              let url
              let fn = null
              let produto = row && row[0]
              if (produto) {
                if (produto.quantity !== saldo) {
                  url = `/products/${produto.ecomplus_id}.json`
                  fn = mysql.updateProductQty(codigo, storeId, saldo, 'tiny')
                }
              } else {
                // alterou foi a variação?
                await mysql.fetchVariations(codigo, storeId).then(rows => {
                  let variation = rows && rows[0]
                  if (variation) {
                    if (variation.quantity !== saldo) {
                      url = `/products/${variation.parent_id}/variations/${variation._id}.json`
                      fn = mysql.updateVariations(codigo, storeId, saldo, 'tiny')
                    }
                  }
                })
              }

              const syncStockWithEcom = (retry = 0) => {
                appSdk.getAuth(storeId).then(({ myId, accessToken }) => {
                  return ecomClient.store({
                    url,
                    storeId,
                    authenticationId: myId,
                    accessToken,
                    method: 'patch',
                    data: {
                      quantity: saldo < 0 ? 0 : saldo
                    }
                  })
                })
                  .then(fn)
                  .then(() => logger.log('>> Estoque do produto %s atualizado para %i', codigo, saldo))
                  .catch(err => {
                    // store err?
                    if (err.response) {
                      const { response } = err
                      if (response.status >= 500) {
                        if (retry <= 4) {
                          setTimeout(() => {
                            retry++
                            return syncStockWithEcom(retry)
                          }, 3000);
                        }
                      }
                    }

                    logger.error('Erro inesperado na tentativa de atualizar estoque, tentando novamente', error)
                  })
              }

              if (url) {
                return syncStockWithEcom()
              }

              return null
            })

            promises.push(promise)
          }

          return Promise.all(promises)
        })
          .then(next)
          .catch(err => {
            if (err.code === 6) {
              console.log('WAIT! API LIMIT, AGAIN :(')
              setTimeout(() => {
                // wait 1m and try to sync current order again 🙏
                return current()
              }, 1 * 60 * 1000)
            } else if (err.code === 20) {
              // nenhum registro alterado, bye
              return next()
            } else if (err.code === 'ECONNABORTED' || err.message.startsWith('Sistema em manuten')) {
              // timeout
              setTimeout(() => {
                // wait 1m and try to sync current order again 🙏
                return next()
              }, 1 * 30 * 1000)
            } else {
              if (err.response) {
                delete err.config.headers
                let erro = {}
                if (err.response.data) {
                  erro.data = err.response.data
                }
                erro.status = err.response.status
                erro.config = err.config
              }
              logger.error('STOCK_MANAGER_ERR', erro)
              next()
            }
          })
      }

      const mp = new MapStores(appSdk)
      const stores = await getStores().catch(reject)
      mp.tasks(stores, callback)
    })
  }

  const stock = () => manager().finally(() => {
    setTimeout(() => {
      return stock()
    }, 5 * 60 * 1000)
  })

  stock()
}
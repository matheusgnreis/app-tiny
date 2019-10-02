'use strict'
const { store } = require('@ecomplus/client')
const db = require('../database')
const TinySchema = require('../schemas/ecomplus-to-tiny')
const TinyVariacao = require('../schemas/ecom/tiny-variations')

module.exports = async (tiny, storeId, idsList, configObj) => {
  return new Promise((resolve, reject) => {
    const sync = (result) => {
      /** promises */
      const promises = []
      /** transaction array */
      const transactions = []

      const unwatched = configObj.unwatched || []

      for (let i = 0; i < result.length; i++) {
        if (unwatched.indexOf(result[i]._id || result[i]) === -1) {
          const url = `/products/${(result[i]._id || result[i])}.json`

          // busca todas as informações do produtos
          const promise = store({ url, storeId })
            .then(({ data }) => {
              // busca pelo produto no banco de dados
              db.fetchProduct(data.sku, storeId)

                .then(row => {
                  if (row && row.length) {
                    // verifica se o produto teve alteração de variação e atualiza o tiny
                    tiny.fetchProducts(row[0].tiny_id)

                      .then(resp => {
                        const { retorno } = resp.data
                        const { status_processamento, produto } = retorno

                        if (parseInt(status_processamento) === 3) {
                          // produto simples
                          if (produto.classe_produto === 'V') {
                            // produto com variação
                            const { variacoes } = produto
                            if (variacoes && variacoes.length) {
                              // percorre as variações do produto da ecomplus
                              const { variations } = data
                              const newVariation = []

                              variations.forEach(variation => {
                                // busca a variação no tiny
                                const find = variacoes.find(v => v.variacao.codigo === variation.sku)

                                // achou a variação
                                if (!find) {
                                  newVariation.push(variation)
                                }
                              })

                              // se houve nova variação
                              // atualiza o produto
                              if (newVariation.length) {
                                const update = TinyVariacao(row[0].id, produto, newVariation)
                                tiny.updateProducts(update).then(() => { console.log('Novas variações adicionadas ao produto', row[0].id) })
                              }
                            }
                          }
                        }
                      })
                  } else {
                    // novo produto
                    const variations = data.variations || undefined
                    db.insertProduct(data.sku, storeId, data._id, null, data.name, data.price, data.quantity, 'ecomplus', variations)

                      .then(result => {
                        transactions.push(TinySchema(data, result.insertId))
                        if (variations) {
                          db.insertVariations(variations, data._id, data.sku, storeId)
                        }
                      })

                      .catch(e => console.error(e.message))
                  }
                })
            })
          promises.push(promise)
        }
      }

      Promise.all(promises).then(() => {
        resolve(transactions)
      })
    }

    if (idsList && idsList.length) {
      sync(idsList)
    } else {
      store({ url: '/products.json', storeId })

        .then(({ data }) => {
          const { result } = data

          if (result && result.length) {
            sync(result)
          }
        })
    }
  })
}

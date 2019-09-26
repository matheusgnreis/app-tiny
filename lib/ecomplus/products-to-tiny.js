'use strict'
process.env.ECOMCLIENT_NOTIMEOUT = true
const { store } = require('@ecomplus/client')
const db = require('../database')
const TinySchema = require('../schemas/ecomplus-to-tiny')
const TinyVariacao = require('../schemas/ecom/tiny-variations')

module.exports = async (tiny, storeId, idsList) => {
  return new Promise((resolve, reject) => {
    const sync = (result) => {
      /** promises */
      const promises = []
      /** transaction array */
      const transactions = []

      for (let i = 0; i < result.length; i++) {
        const url = `/products/${(result[i]._id || result[i])}.json`

        // busca todas as informações do produtos
        const promise = store({ url, storeId })
          .then(({ data }) => {
            // busca pelo produto no banco de dados
            db.fetchProduct(data.sku, storeId)

              .then(row => {
                if (row && row.length) {
                  // se o produto existir no db
                  // verifica se a quantidade do produtos na api é diferente do bd
                  const qty = data.quantity ? data.quantity : null
                  if (row[0].quantity !== qty) {
                    // atualiza no banco
                    db.updateProduct(data.sku, storeId, data.quantity, 'ecomplus')

                      .then(() => {
                        // atualiza o tiny
                        tiny.fetchProducts(row[0].tiny_id)

                          .then(resp => {
                            const { retorno } = resp.data
                            const { status_processamento, produto } = retorno

                            if (parseInt(status_processamento) === 3) {
                              // produto simples
                              if (produto.classe_produto === 'S') {
                                // busca o estoque do produto
                                tiny.fetchStock(row[0].tiny_id)
                                  .then(result => {
                                    const { retorno } = result.data
                                    const { produto } = retorno
                                    const { saldo } = produto
                                    // verifica se as quantidades são difererntes
                                    if (saldo !== qty) {
                                      // atualiza o estoque
                                      tiny.updateStock(row[0].tiny_id, qty)
                                        .then((r) => {
                                          console.log('Produto simples atualizado', JSON.stringify(r.data))
                                        })
                                    }
                                  })
                              } else {
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
                                    if (find) {
                                      // verifica se o estoque é o mesmo
                                      tiny.fetchStock(find.variacao.id)
                                        .then(result => {
                                          const { retorno } = result.data
                                          const { produto } = retorno
                                          const { saldo } = produto
                                          const variationQty = variation.quantity || 0
                                          if (saldo !== variationQty) {
                                            // atualiza o estoque
                                            tiny.updateStock(find.variacao.id, variationQty)
                                              .then((r) => { console.log('Variação atualizada', JSON.stringify(r.data)) })
                                          }
                                        })
                                    } else {
                                      // nao encontrou
                                      // todo
                                      newVariation.push(variation)
                                    }
                                  })

                                  // se houve nova variação
                                  // atualiza o produto
                                  if (newVariation.length) {
                                    const update = TinyVariacao(row[0].id, produto, newVariation)
                                    tiny.updateProducts(update)
                                      .then(() => { console.log('Produto atualizado variações adicionada.') })
                                  }
                                }
                              }
                            }
                          })
                      })
                  }
                } else {
                  // se não existir
                  // insere no banco
                  const variations = data.variations || undefined
                  // salva no banco
                  db.insertProduct(data.sku, storeId, data._id, null, data.name, data.price, data.quantity, 'ecomplus', variations)
                    // insere na transação
                    .then(result => {
                      transactions.push(TinySchema(data, result.insertId))
                      if (variations) {
                        db.insertVariations(variations, data._id, data.sku, storeId)
                      }
                    })
                    // catch
                    .catch(e => console.error(e.message))
                }
              })
          })
        promises.push(promise)
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

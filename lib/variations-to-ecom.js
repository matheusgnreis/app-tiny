const getProductQty = require('./../lib/tiny/get-product-quantity')
const { insertVariations } = require('./../lib/database')
module.exports = (tiny, appSdk, storeId) => {
  return (variacoes, productId) => {
    setVariations(tiny, appSdk, storeId)(variacoes, productId)
  }
}

let i = 0
const setVariations = (tiny, appSdk, storeId) => {
  return (variacoes, productId, parentSku) => {
    if (variacoes[i]) {
      tiny.fetchProducts(variacoes[i].variacao.id)
        .then(async result => {
          const { retorno } = result.data
          const { codigo_erro, status, status_processamento, produto } = retorno

          if (parseInt(status_processamento) === 3) {
            const variation = {
              sku: produto.codigo || undefined,
              name: produto.nome,
              gtin: produto.gtin !== '' ? produto.gtin : undefined,
              price: produto.preco,
              cost_price: Number(produto.preco_custo),
              quantity: await getProductQty(tiny, produto.id),
              weight: {
                value: parseFloat(produto.peso_bruto)
              },
              dimensions: {
                width: {
                  value: parseFloat(produto.larguraEmbalagem),
                  unit: 'cm'
                },
                height: {
                  value: parseFloat(produto.alturaEmbalagem),
                  unit: 'cm'
                },
                length: {
                  value: parseFloat(produto.peso_liquido),
                  unit: 'cm'
                }
              }
            }
            // specifications
            if (variacoes[i].variacao.hasOwnProperty('grade')) {
              console.log('tem grade')
              variation.specifications = {}
              for (const key in variacoes[i].variacao.grade) {
                if (variacoes[i].variacao.grade.hasOwnProperty(key)) {
                  const specification = {
                    text: variacoes[i].variacao.grade[key]
                    // value: variacoes[i].variacao.grade[key]
                  }
                  variation.specifications[key] = variation.specifications[key] || []
                  variation.specifications[key].push(specification)
                }
              }
            }
            console.log(JSON.stringify(variation))
            const resource = `/products/${productId}/variations.json`
            const method = 'POST'
            return appSdk.apiRequest(storeId, resource, method, variation)
              .then(() => {
                // salva no db a variação
                insertVariations(variation, productId, parentSku, storeId)
                i++
                setVariations(tiny, appSdk, storeId)(variacoes, productId)
              })
              .catch(e => {
                console.log(e)
                i++
                setVariations(tiny, appSdk, storeId)(variacoes, productId)
              })
          } else if (parseInt(status_processamento) < 3 && status === 'Erro') {
            if (!isNaN(parseInt(codigo_erro)) && parseInt(codigo_erro) === 6) {
              // to many requests
              console.log('[setVariations] many request')
              setTimeout(() => {
                // try again
                return setVariations(tiny, appSdk, storeId)(variacoes, productId)
              }, 60000)
            }
          } else {
            i++
            setVariations(tiny, appSdk, storeId)(variacoes, productId)
          }
        })
    }
  }
}

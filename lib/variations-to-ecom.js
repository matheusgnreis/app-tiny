const getProductQty = require('./../lib/tiny/get-product-quantity')
const { insertVariations } = require('./../lib/database')
const logger = require('console-files')

module.exports = (tiny, appSdk, storeId) => {
  return (variacoes, productId) => {
    logger.log(`[!] Sending ${variacoes.length} variation to store-api`)
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
          const { status, produto } = retorno

          if (parseInt(retorno.status_processamento) === 3) {
            const variation = {
              sku: getSku(produto),
              name: produto.nome,
              gtin: getGtin(produto),
              price: Number(produto.preco),
              cost_price: Number(produto.preco_custo),
              quantity: await getProductQty(tiny, produto.id),
              weight: {
                value: parseFloat(produto.peso_bruto),
                unit: 'kg'
              },
              dimensions: {
                width: {
                  value: parseFloat(produto.larguraEmbalagem) || 0,
                  unit: 'cm'
                },
                height: {
                  value: parseFloat(produto.alturaEmbalagem) || 0,
                  unit: 'cm'
                },
                length: {
                  value: parseFloat(produto.comprimentoEmbalagem) || 0,
                  unit: 'cm'
                }
              }
            }

            // specifications
            if (variacoes[i].variacao.hasOwnProperty('grade')) {
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
            const resource = `/products/${productId}/variations.json`
            const method = 'POST'
            return appSdk.apiRequest(storeId, resource, method, variation)
              .then(() => {
                // salva no db a variação
                insertVariations(variation, productId, parentSku, storeId)
                i++
                logger.log(`Variation ${i} save at product ${productId}`)
                setVariations(tiny, appSdk, storeId)(variacoes, productId)
              })
              .catch(e => {
                logger.error('SyncVariationsErr', e.response.data)
                i++
                setVariations(tiny, appSdk, storeId)(variacoes, productId)
              })
          } else if (parseInt(retorno.status_processamento) < 3 && status === 'Erro') {
            if (!isNaN(parseInt(retorno.codigo_erro)) && parseInt(retorno.codigo_erro) === 6) {
              // to many requests
              logger.log('[setVariations] many request, waiting 1m')
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

const getGtin = (produto) => {
  if (produto.gtin !== '' && produto.gtin !== 'SEM GTIN') {
    const { gtin } = produto
    return gtin
  }

  return undefined
}

const getSku = produto => {
  if (!produto.codigo || produto.codigo === '' || produto.codigo.length <= 2) {
    return undefined
  } else {
    return produto.codigo
  }
}

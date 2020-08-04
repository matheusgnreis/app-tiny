
module.exports = (product, seq) => {
  const weight = product.weight || {}
  const brands = product.brands || []
  const dimensions = product.dimensions || {}

  let payload = {
    produto: {
      sequencia: seq,
      nome: product.name || '',
      codigo: product.sku,
      unidade: 'UN',
      preco: product.price,
      origem: 0,
      gtin: product.gtin || '',
      peso_liquido: weight.value || '',
      estoque_atual: product.quantity || 0,
      situacao: 'A',
      tipo: 'P',
      descricao_complementar: product.short_description,
      marcas: brands.length ? brands[0].name : '',
      altura_embalagem: dimensions.height ? dimensions.height.value : '',
      largura_embalagem: dimensions.width ? dimensions.width.value : '',
      comprimento_embalagem: dimensions.length ? dimensions.length.value : '',
      anexos: [],
      classe_produto: product.variations ? 'V' : 'S'
    }
  }

  // variations
  if (product.variations) {
    payload.produto.variacoes = []
    product.variations.forEach(variation => {
      let grade = {}

      for (const key in variation.specifications) {
        for (const chave in variation.specifications[key]) {
          grade[key] = variation.specifications[key][chave].text
        }
      }
      payload.produto.variacoes.push({
        variacao: {
          codigo: variation.sku,
          preco: variation.price || product.price,
          estoque_atual: variation.quantity || 0,
          grade: grade
        }
      })
    })
  }

  let pictures = product.pictures || []
  pictures.forEach(picture => {
    if (picture.normal) {
      payload.produto.anexos.push({
        anexo: picture.normal.url
      })
    }
  })

  return payload
}

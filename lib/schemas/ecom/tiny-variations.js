module.exports = (sequencia, payload, variations) => {
  // remove as atuais variações
  payload.variacoes = []
  // define a sequencia do produto
  payload.sequencia = sequencia
  // monta as novas variações
  variations.forEach(variation => {
    const grade = {}

    for (const key in variation.specifications) {
      for (const chave in variation.specifications[key]) {
        grade[key] = variation.specifications[key][chave].text
      }
    }

    payload.variacoes.push({
      variacao: {
        codigo: variation.sku,
        preco: variation.price,
        estoque_atual: variation.quantity || 0,
        grade: grade
      }
    })
  })

  return {
    produto: payload
  }
}

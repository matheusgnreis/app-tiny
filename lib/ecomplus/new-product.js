'use strict'
const { randomObjectId } = require('@ecomplus/utils')

module.exports = (produto) => {
  const schema = {}
  if (produto.codigo && produto.codigo !== '') {
    schema.sku = produto.codigo
  }
  schema.name = produto.nome || ''
  schema.slug = produto.nome.toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')
  schema.available = (produto.situacao === 'A') || false
  schema.visible = (produto.situacao === 'A') || false
  schema.price = Number(produto.preco)
  schema.cost_price = Number(produto.preco_custo)
  schema.short_description = produto.nome
  if (produto.descricao_complementar && produto.descricao_complementar !== '') {
    schema.body_html = produto.descricao_complementar.replace(/"/g, "'")
  }
  schema.quantity = (produto.saldo && produto.saldo > 0) ? produto.saldo : 0
  schema.brands = getBrands(produto)
  schema.categories = getCategories(produto)
  schema.category_tree = getCategoryTree(produto)
  schema.weight = {
    value: parseFloat(produto.peso_bruto) || 0,
    unit: 'kg'
  }
  schema.gtin = getGtin(produto)
  schema.dimensions = {
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

  schema.condition = 'not_specified'

  // pictures
  if (produto.anexos) {
    schema.pictures = []

    produto.anexos.forEach(anexo => {
      const picture = {
        normal: {
          url: anexo.anexo
        },
        _id: randomObjectId()
      }

      schema.pictures.push(picture)
    })
  }

  return schema
}

const getGtin = (produto) => {
  const gtins = []
  if (produto.gtin !== '' && produto.gtin !== 'SEM GTIN') {
    const { gtin } = produto
    gtins.push(gtin)
  }

  return gtins
}

const getBrands = (produto) => {
  const brands = []
  if (produto.brands !== '' && produto.brands !== 'SEM MARCA') {
    brands.push({
      _id: randomObjectId(),
      name: produto.brands
    })
  }
}

const getCategories = produto => {
  const resp = []

  if (produto.categoria && produto.categoria !== '') {
    const { categoria } = produto
    if (/>>/.test(categoria)) {
      let categories = String(categoria.replace(' ', ''))
      categories = categories.split('>>')
      categories.forEach(category => resp.push({ _id: randomObjectId(), name: category.trim() }))
    } else {
      resp.push({
        name: categoria,
        _id: randomObjectId()
      })
    }
  }

  return resp
}

const getCategoryTree = produto => {
  let tree
  if (produto.categoria && produto.categoria !== '') {
    const { categoria } = produto
    if (/>>/.test(categoria)) {
      let categories = String(categoria.replace(' ', ''))
      categories = categories.split('>>')
      tree = `${categories[0].trim()} > ${categories[1].trim()}`
    }
  }
  return tree
}

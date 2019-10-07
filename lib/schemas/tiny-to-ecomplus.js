'use strict'
const getProductQty = require('./../tiny/get-product-quantity')
const { randomObjectId } = require('@ecomplus/utils')
module.exports = async (produto, tiny) => {
  const schema = {}
  schema.sku = produto.codigo || ''
  schema.name = produto.nome || ''
  schema.available = (produto.situacao === 'A') || false
  schema.visible = (produto.situacao === 'A') || false
  schema.price = Number(produto.preco)
  schema.cost_price = Number(produto.preco_custo)
  schema.short_description = produto.nome
  schema.body_html = produto.descricao_complementar
  schema.quantity = await getProductQty(tiny, produto.id)
  // schema.brands = [{
  //   name: produto.marca || ''
  // }]
  // schema.categories = [{
  //   name: produto.categoria || ''
  // }]
  schema.weight = {
    value: parseFloat(produto.peso_bruto) || 0,
    unit: 'kg'
  }
  schema.gtin = produto.gtin !== '' ? produto.gtin : []
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

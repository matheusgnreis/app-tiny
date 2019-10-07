const tinyStatus = require('./../tiny-status')
const moment = require('moment')
moment.locale()

module.exports = order => {
  const buyers = order.buyers ? order.buyers[0] : {}
  const transactions = order.transactions ? order.transactions[0] : {}
  const shippingLines = order.shipping_lines ? order.shipping_lines[0] : {}
  const financialStatus = order.financial_status ? order.financial_status.current : ''
  const address = shippingLines.to || {}
  const payload = {
    pedido: {
      data_pedido: moment(order.created_at).format('DD/MM/YYYY'),
      cliente: {
        codigo: buyers._id,
        nome: buyers.display_name,
        tipo_pessoa: buyers.registry_type === 'P' ? 'F' : 'J',
        cpf_cnpj: buyers.doc_number,
        endereco: address.street || '',
        numero: address.number || '',
        bairro: address.borough || '',
        cep: address.zip || '',
        cidade: address.city || '',
        uf: address.province_code || '',
        fone: buyers.phones ? buyers.phones[0].number : ''
      },
      itens: [],
      nome_transportador: shippingLines.app ? shippingLines.app.carrier : '',
      forma_pagamento: paymentMethod(transactions),
      valor_frete: shippingLines.price,
      valor_desconto: shippingLines.discount || 0,
      numero_pedido_ecommerce: order.number,
      situacao: tinyStatus(financialStatus),
      forma_envio: 'X',
      forma_frete: order.shipping_method_label
    }
  }

  if (order.items) {
    order.items.forEach(item => {
      payload.pedido.itens.push({
        item: {
          codigo: item.sku,
          descricao: item.name,
          unidade: 'UN',
          quantidade: item.quantity,
          valor_unitario: item.price
        }
      })
    })
  }

  return payload
}

const paymentMethod = transaction => {
  const pm = transaction ? transaction.payment_method : {}
  if (pm) {
    if (pm.code === 'credit_card') {
      return 'Credito'
    } else if (pm.code === 'banking_billet') {
      return 'Boleto'
    } else {
      return ''
    }
  } else {
    return ''
  }
}

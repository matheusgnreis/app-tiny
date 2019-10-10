'use strict'
const ecomClient = require('@ecomplus/client')
const { randomObjectId } = require('@ecomplus/utils')
const logger = require('console-files')
const TinySituacao = require('./schemas/tiny-situacao')
const Tiny = require('./tiny/client')
const mysql = require('./database')
const getStores = require('../lib/get-stores')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')

// current date
const getPeriod = () => {
  const data = new Date()
  const year = data.getFullYear()
  const month = (`00${data.getMonth() + 1}`).slice(-2)
  const day = (`00${data.getDate()}`).slice(-2)
  return `${day}/${month}/${year}`
}

module.exports = (appSdk) => {
  console.log('--> Orders watcher')

  const fetchPedidosList = tiny => tiny.findOrders(getPeriod(), getPeriod())
    .then(result => {
      const { retorno } = result.data
      const { pedidos, status_processamento } = retorno
      if (parseInt(status_processamento) === 3) {
        if (pedidos && pedidos.length) {
          const parse = pedidos.map(pedido => pedido.pedido)
          return parse
        }
      } else {
        // erro return empty
        return []
      }
    })

  const fetchPedido = tiny => id => tiny.findOrderById(id)
    .then(result => {
      const { retorno } = result.data
      const { pedido, status_processamento } = retorno
      if (parseInt(status_processamento) === 3) {
        return pedido
      } else {
        // erro return empty
        return {}
      }
    })

  let currentStore
  const task = (stores) => {
    const store = stores[currentStore]
    if (store && store.store_id) {
      const storeId = store.store_id
      getConfig({ appSdk, storeId }, true)

        .then(configObj => {
          // tiny
          const tiny = new Tiny(configObj.access_token)
          // app auth
          appSdk.getAuth(storeId)

            .then(async ({ myId, accessToken }) => {
              // pega lista de pedidos alterados da loja
              let currentOrder = 0
              const ordersList = await fetchPedidosList(tiny)
              const checkOrder = orders => {
                if (ordersList[currentOrder]) {
                  const { id, numero_ecommerce, url_rastreamento, codigo_rastreamento } = ordersList[currentOrder]

                  // busca o pedido no banco de dados
                  // verifica se ha alteração
                  mysql.findOrder(id, numero_ecommerce, storeId)
                    .then(row => {
                      if (row && row.length) {
                        // busca o pedido no tiny
                        // compara com o banco de dados
                        fetchPedido(tiny)(id).then(pedido => {
                          if (pedido) {
                            const url = `/orders/${row[0]._id}.json`
                            const options = { url, storeId, authenticationId: myId, accessToken }
                            ecomClient
                              .store(options)
                              .then(({ data }) => {
                                // payment_history/fulfillment
                                if (row[0].tiny_status !== TinySituacao(pedido.situacao)) {
                                  options.method = 'post'
                                  options.data = {}
                                  let ecomStatus = data.financial_status ? data.financial_status.current : ''
                                  switch (pedido.situacao) {
                                    case 'Em aberto':
                                      options.url = `/orders/${row[0]._id}/payments_history.json`
                                      options.data = {
                                        status: 'pending'
                                      }
                                      ecomStatus = 'pending'
                                      break
                                    case 'Aprovado':
                                      options.url = `/orders/${row[0]._id}/payments_history.json`
                                      options.data = {
                                        status: 'paid'
                                      }
                                      ecomStatus = 'paid'
                                      break
                                    case 'Faturado (atendido)':
                                      options.url = `/orders/${row[0]._id}/payments_history.json`
                                      options.data = {
                                        status: 'pending'
                                      }
                                      ecomStatus = 'paid'
                                      break
                                    case 'Cancelado':
                                      options.url = `/orders/${row[0]._id}/payments_history.json`
                                      options.data = {
                                        status: 'voided'
                                      }
                                      ecomStatus = 'voided'
                                      break
                                    case 'Pronto para envio':
                                      options.url = `/orders/${row[0]._id}/fulfillments.json`
                                      options.data = {
                                        status: 'ready_for_shipping'
                                      }
                                      break
                                    case 'Enviado':
                                      options.url = `/orders/${row[0]._id}/fulfillments.json`
                                      options.data.status = 'shipped'
                                      break
                                    case 'Entregue':
                                      options.url = `/orders/${row[0]._id}/fulfillments.json`
                                      options.data = {
                                        status: 'delivered'
                                      }
                                      break

                                    case 'Preparando envio':
                                      options.url = `/orders/${row[0]._id}/fulfillments.json`
                                      options.data = {
                                        status: 'in_separation'
                                      }
                                      break
                                    default: break
                                  }

                                  ecomClient
                                    .store(options)
                                    .then(() => mysql.updateSituacao('tiny_status', storeId, row[0]._id, pedido.situacao, 'tiny'))
                                    .then(() => mysql.updateSituacao('ecom_status', storeId, row[0]._id, ecomStatus, 'ecomplus'))
                                    .catch(e => logger.error('TINY_UPDATE_ORDER_STATUS_ERR', e))
                                }

                                // tracking_code
                                if (codigo_rastreamento !== null && codigo_rastreamento !== row[0].tracking) {
                                  options.url = `/orders/${row[0]._id}/shipping_lines/${data.shipping_lines[0]._id}.json`
                                  options.data = {
                                    tracking_codes: {
                                      code: codigo_rastreamento,
                                      tag: 'Tiny',
                                      link: url_rastreamento
                                    }
                                  }
                                  options.method = 'patch'
                                  ecomClient
                                    .store(options)
                                    .then(() => mysql.query('UPDATE orders SET tracking = ? WHERE store_id = ? AND _id = ?', [codigo_rastreamento, storeId, data._id]))
                                    .catch(e => logger.error('TINY_UPDATE_ORDER_SHIPING_LINES_ERR', e))
                                }

                                // invoices
                                if (pedido.id_nota_fiscal !== '0' && pedido.id_nota_fiscal !== null && pedido.id_nota_fiscal !== row[0].invoice) {
                                  tiny.findNF(pedido.id_nota_fiscal).then(async notaFiscal => {
                                    if (notaFiscal && notaFiscal.situacao === '6') {
                                      // insere a entrada no fulfillment
                                      options.url = `/orders/${row[0]._id}/fulfillments.json`
                                      options.method = 'post'
                                      options.data = {
                                        _id: randomObjectId(),
                                        status: 'invoice_issued'
                                      }
                                      ecomClient.store(options).catch(e => logger.error('TINY_UPDATE_ORDER_INVOICE_ISSUED_ERR', e))

                                      // insere a nota no invoice
                                      options.url = `/orders/${row[0]._id}/shipping_lines/${data.shipping_lines[0]._id}.json`
                                      options.method = 'patch'
                                      options.data = {
                                        invoices: [
                                          {
                                            number: notaFiscal.numero,
                                            link: await tiny.fetchNFLink(pedido.id_nota_fiscal)
                                          }
                                        ]
                                      }
                                      ecomClient.store(options)
                                        .then(() => mysql.query('UPDATE orders SET invoice = ? WHERE store_id = ? AND _id = ?', [pedido.id_nota_fiscal, storeId, data._id]))
                                        .catch(e => logger.error('TINY_UPDATE_ORDER_INVOICE_ERR', e))
                                    }
                                  })
                                }

                                currentOrder++
                                checkOrder(orders)
                              })
                          }
                        })
                      }
                    })
                  currentOrder++
                  checkOrder(orders)
                } else {
                  currentOrder++
                  task(store)
                }
              }
              checkOrder(ordersList)
            })
        })
    }
  }

  const start = async () => {
    currentStore = 0
    const stores = await getStores()
    task(stores)
  }

  start()
  // interval 5m
  const interval = 6 * 60 * 1000
  setInterval(start, interval)
}

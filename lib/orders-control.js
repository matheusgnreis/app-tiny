'use strict'
const ecomClient = require('@ecomplus/client')
const { randomObjectId } = require('@ecomplus/utils')
const logger = require('console-files')
const Tiny = require('./tiny/client')
const mysql = require('./database')
const getStores = require('./get-stores')
const MapStores = require('./map-stores')
// tiny response handler
const respHandler = require('./tiny/resp-handler')

module.exports = appSdk => {
  logger.log('--> Orders Control')

  // return current date
  const getPeriod = () => {
    const data = new Date()
    const year = data.getFullYear()
    const month = (`00${data.getMonth() + 1}`).slice(-2)
    const day = (`00${data.getDate()}`).slice(-2)
    return `${day}/${month}/${year}`
  }

  const ordersControl = () => new Promise((resolve, reject) => {
    const mp = new MapStores(appSdk)
    const callback = function (configObj, storeId, next, current, err) {
      if (!err && storeId) {
        const { sync } = configObj
        if (!configObj.access_token || !sync || !sync.tiny || !sync.tiny.stock || sync.tiny.stock === false) {
          return next()
        }

        const tiny = new Tiny(configObj.access_token)
        let retry = 0

        appSdk.getAuth(storeId)

          .then(({ myId, accessToken }) => {
            return tiny.findOrders(getPeriod()).then(resp => ({ resp, myId, accessToken }))
          })

          .then(({ resp, myId, accessToken }) => {
            resp = respHandler(resp)
            return { resp, myId, accessToken }
          })

          .then(({ resp, myId, accessToken }) => {
            const { success, error, pedidos } = resp
            if (success) {
              let index = 0
              const queue = function () {
                const nextOrder = () => {
                  index++
                  queue()
                }
                // no more orders
                // next store
                if (!pedidos[index]) {
                  next()
                }

                const pedido = pedidos[index]

                // find order in db
                mysql.findOrder(pedido.id, pedido.numero_ecommerce, storeId)
                  .then(row => row[0])
                  .then(row => {
                    // order not found?
                    // so next order
                    if (!row) {
                      nextOrder()
                    }
                    const url = `/orders/${row._id}.json`
                    const options = { url, storeId, authenticationId: myId, accessToken }
                    // find order on plataform
                    ecomClient
                      .store(options)
                      .then(({ data }) => {
                        // update order payment_history/fulfillment
                        if (row.tiny_status !== pedido.situacao) {
                          // payment_history
                          let url = `/orders/${row._id}/payments_history.json`
                          let status
                          let statusEcom = data.financial_status ? data.financial_status.current : ''
                          switch (pedido.situacao) {
                            case 'Em aberto':
                            case 'Faturado (atendido)':
                              status = 'pending'
                              statusEcom = 'pending'
                              break
                            case 'Aprovado':
                              status = 'paid'
                              statusEcom = 'paid'
                              break
                            case 'Cancelado':
                              status = 'voided'
                              statusEcom = 'voided'
                              break
                            case 'Pronto para envio':
                              status = 'ready_for_shipping'
                              url = `/orders/${row._id}/fulfillments.json`
                              break
                            case 'Enviado':
                              url = `/orders/${row._id}/fulfillments.json`
                              status = 'shipped'
                              break
                            case 'Entregue':
                              url = `/orders/${row._id}/fulfillments.json`
                              status = 'delivered'
                              break
                            case 'Preparando envio':
                              url = `/orders/${row._id}/fulfillments.json`
                              status = 'in_separation'
                              break
                            default:
                              status = 'pending'
                              statusEcom = 'pending'
                              break
                          }

                          options.url = url
                          options.method = 'post'
                          options.data = {
                            status,
                            date_time: new Date().toISOString()
                          }

                          ecomClient
                            .store(options)
                            .then(() => {
                              return mysql.query('UPDATE orders SET tiny_status = ?, ecom_status = ?, last_change_by = ?, updated_at = CURRENT_TIMESTAMP() WHERE store_id = ? AND _id = ?', [pedido.situacao, statusEcom, 'tiny', storeId, row._id])
                            })
                            .catch(e => {
                              if (e.response && e.response.status >= 500) {
                                // try again
                                if (retry <= 4) {
                                  retry++
                                  setTimeout(() => {
                                    return ecomClient(options)
                                  }, 4000)
                                }
                              }
                            })
                        }

                        // update order shipping_lines
                        if (pedido.codigo_rastreamento && (pedido.codigo_rastreamento !== row.tracking)) {
                          const shippingLines = data.shipping_lines.find(shipping => shipping._id)
                          options.url = `/orders/${row._id}/shipping_lines/${shippingLines._id}.json`
                          options.data = {
                            tracking_codes: [
                              {
                                code: pedido.codigo_rastreamento,
                                tag: 'tiny',
                                link: pedido.url_rastreamento
                              }
                            ]
                          }
                          options.method = 'patch'
                          ecomClient
                            .store(options)
                            .then(() => mysql.query('UPDATE orders SET tracking = ?, updated_at = CURRENT_TIMESTAMP() WHERE store_id = ? AND _id = ?', [pedido.codigo_rastreamento, storeId, data._id]))
                            .catch(e => {
                              if (e.response && e.response.status >= 500) {
                                // try again
                                if (retry <= 4) {
                                  retry++
                                  setTimeout(() => {
                                    return ecomClient(options)
                                  }, 4000)
                                }
                              }
                            })
                        }

                        // update order invoice
                        if ((pedido.id_nota_fiscal && pedido.id_nota_fiscal !== '0') && (pedido.id_nota_fiscal !== row.invoice)) {
                          const updateNF = () => tiny
                            .findNF(pedido.id_nota_fiscal)
                            .then(resp => respHandler(resp))
                            .then(resp => {
                              const { success, error, notaFiscal } = resp
                              if (success && notaFiscal) {
                                if (notaFiscal.situacao === '6') {
                                  // insere a entrada no fulfillment
                                  options.url = `/orders/${row._id}/fulfillments.json`
                                  options.method = 'post'
                                  options.data = {
                                    _id: randomObjectId(),
                                    status: 'invoice_issued'
                                  }

                                  ecomClient.store(options).catch(e => {
                                    if (e.response && e.response.status >= 500) {
                                      // try again
                                      if (retry <= 4) {
                                        retry++
                                        setTimeout(() => {
                                          return ecomClient(options)
                                        }, 4000)
                                      }
                                    }
                                  })

                                  // get nf link
                                  const updateNfLink = () => tiny.fetchNFLink(pedido.id_nota_fiscal)
                                    .then(resp => respHandler(resp))
                                    .then(resp => {
                                      const { success, error, notaFiscalLink } = resp
                                      if (success && notaFiscalLink) {
                                        const shippingLines = data.shipping_lines.find(shipping => shipping._id)
                                        options.url = `/orders/${row._id}/shipping_lines/${shippingLines._id}.json`
                                        options.method = 'patch'
                                        options.data = {
                                          invoices: [
                                            {
                                              number: notaFiscal.numero,
                                              link: notaFiscalLink
                                            }
                                          ]
                                        }

                                        ecomClient
                                          .store(options)
                                          .then(() => mysql.query('UPDATE orders SET invoice = ?, updated_at = CURRENT_TIMESTAMP() WHERE store_id = ? AND _id = ?', [pedido.id_nota_fiscal, storeId, data._id]))
                                          .catch(e => {
                                            if (e.response && e.response.status >= 500) {
                                              // try again
                                              if (retry <= 4) {
                                                retry++
                                                setTimeout(() => {
                                                  return ecomClient(options)
                                                }, 4000)
                                              }
                                            }
                                          })
                                      } else if (error) {
                                        const { erro } = resp.error
                                        if (erro.code === 4290) {
                                          /* to many */
                                          setTimeout(() => updateNfLink(), 1 * 60 * 1000)
                                        }
                                      }
                                    })

                                  updateNfLink()
                                }
                              } else if (error && !success) {
                                const { erro } = resp.error
                                if (erro.code === 4290) {
                                  /* to many */
                                  setTimeout(() => updateNF(), 1 * 60 * 1000)
                                }
                              }
                            })

                          updateNF()
                        }
                        // update
                      })
                      .then(() => nextOrder())
                      .catch(e => {
                        if (e.response && e.response.status >= 500) {
                          // try again
                          if (retry <= 4) {
                            retry++
                            setTimeout(() => {
                              return ecomClient(options)
                            }, 4000)
                          }
                        }
                      })
                  })
              }
              queue(pedidos)
            } else if (error && !success) {
              const { erro } = resp.error
              if (erro.code === 4290) {
                /* to many */
                setTimeout(() => current(), 1 * 60 * 1000)
              } else if (erro.code === 4004) {
                // no results
                // glow
                return next()
              }
            }
          })

          .catch(() => next())
      } else if (err && storeId) {
        // erro with appSdk or getConfig()
        // will be handle by mp.tasks()
        return next()
      } else if (!configObj && !storeId && !next && !current) {
        // no more stores, bye
        resolve()
      }
    }

    getStores()
      .then(stores => mp.tasks(stores, callback))
      .catch(reject)
  })

  const start = () => ordersControl().finally(() => {
    const interval = 3 * 60 * 1000
    setTimeout(() => start(), interval)
  })

  setTimeout(() => start(), 2 * 60 * 100)
}

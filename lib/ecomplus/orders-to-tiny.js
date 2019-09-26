'use strict'
const { store } = require('@ecomplus/client')
const db = require('../database')
const TinySchema = require('../schemas/ecom/orders-to-tiny')
const TinySituacao = require('../schemas/tiny-status')

module.exports = async (tiny, appSdk, storeId, ordersList) => {
  return new Promise((resolve, reject) => {
    const sync = result => {
      if (result && result.length) {
        /** promises */
        const promises = []
        /** transaction array */
        const transactions = []

        for (let i = 0; i < result.length; i++) {
          // procura a order no banco de dados
          const promise = db.fetchOrders(result[i]._id, storeId)

            .then(row => {
              const ecomStatus = result[i].financial_status ? result[i].financial_status.current : null
              if (row && row.length) {
                // se o pedido existir no banco de dados
                // verifica se o status da api é diferente do status do banco
                if (row[0].ecom_status !== ecomStatus) {
                  // atualiza o banco se diferente
                  db.updateSituacao('ecom_status', storeId, result[i]._id, ecomStatus, 'ecomplus')

                    .then(() => {
                      // verifica se o status da api é difente do tiny
                      if (row[0].tiny_status !== TinySituacao(ecomStatus)) {
                        // atualiza situação na api do tiny
                        tiny.updateSituacao(row[0].tiny_id, TinySituacao(ecomStatus))

                          .then((r) => {
                            // atualiza situação no banco de dados
                            db.updateSituacao('tiny_status', storeId, result[i]._id, TinySituacao(ecomStatus), 'tiny')
                          })
                      }
                    })
                }
              } else {
                // se não existir
                // insere no banco
                return db.insertOrders(storeId, result[i]._id, ecomStatus, TinySituacao(ecomStatus), result[i].number, null, 'ecomplus')

                  .then(() => {
                    const schema = TinySchema(result[i])
                    // insere na transação
                    transactions.push(schema)
                  })
              }
            })

          promises.push(promise)
        }

        // promises resolvidas
        Promise.all(promises).then(() => {
          resolve(transactions)
        })
      }
    }

    if (ordersList) {
      sync(ordersList)
    } else {
      appSdk.getAuth(storeId)

        .then(({ myId, accessToken }) => {
          const fields = '_id,source_name,channel_id,number,code,status,financial_status,amount,payment_method_label,shipping_method_label,buyers,items,created_at,transactions'
          const url = `/orders.json?fields=${fields}`
          return store({
            url,
            storeId,
            authenticationId: myId,
            accessToken
          })

            .then(({ data }) => {
              const { result } = data
              sync(result)
            })
        })

        .catch(err => { reject(new Error(err)) })
    }
  })
}

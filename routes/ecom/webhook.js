'use strict'

// read configured E-Com Plus app data
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const parseOrderStatus = require('./../../lib/ecomplus/parse-orders-status')
const { promise } = require('@ecomplus/application-sdk')
const SKIP_TRIGGER_NAME = 'SkipTrigger'
const ECHO_SUCCESS = 'SUCCESS'
const ECHO_SKIP = 'SKIP'
const ECHO_API_ERROR = 'STORE_API_ERR'

module.exports = ({ appSdk, logger, mysql, tinyClient }) => {
  return (req, res) => {
    const { storeId } = req
    /*
    Treat E-Com Plus trigger body here
    // https://developers.e-com.plus/docs/api/#/store/triggers/
    */
    const trigger = req.body

    // get app configured options
    getConfig({ appSdk, storeId }, true)

      .then(async configObj => {
        /* Do the stuff */
        if (!configObj.enabled_sync_others_status) {
          let promise
          const url = `/orders/${(trigger.inserted_id || trigger.resource_id)}.json`
          const orderBody = await appSdk.apiRequest(storeId, url).then(({ response }) => response.data)
          const financialStatus = orderBody.financial_status ? orderBody.financial_status.current : null

          if (trigger.action === 'create' && orderBody.status !== 'cancelled') {
            promise = mysql.fetchOrders(trigger.inserted_id, storeId).then(row => {
              if (!row || !row.length) {
                return mysql.insertOrders(storeId, trigger.inserted_id, financialStatus, parseOrderStatus(financialStatus), orderBody.number, null, 'ecom')
                  .then(() => logger.log('Pedido salvo:', trigger.inserted_id))
              }
              return
            })
          } else if (trigger.action === 'change' && trigger.fields.includes('financial_status')) {
            promise = mysql.fetchOrders(trigger.resource_id, storeId).then(row => {
              if (row) {
                const order = row[0]
                if (financialStatus && financialStatus !== order.ecom_status) {
                  return tinyClient({
                    url: 'pedido.alterar.situacao',
                    token: configObj.access_token,
                    params: {
                      id: order.tiny_id,
                      situacao: parseOrderStatus(financialStatus)
                    }
                  }, true).then(() => {
                    const sql = 'update orders set ' +
                      'tiny_status = ?, ' +
                      'ecom_status = ? ' +
                      'where store_id = ? ' +
                      'and _id = ?'
                    return mysql.query(sql, [parseOrderStatus(financialStatus), financialStatus, storeId, orderBody._id])
                  }).then(() => {
                    logger.log('Pedido atualizado no tiny; ', orderBody._id)
                  })
                    .catch(err => {
                      console.log(err)
                      if (err.code === 6) {
                        console.log('Api Limit')
                        setTimeout(() => {
                          console.log('Tentando novamente')
                          return Promise.resolve(promise)
                        }, 1 * 60 * 1000);
                      }
                    })
                }
              }
              return
            })
          }
        }

        return promise
      })
      .then(() => res.send(ECHO_SUCCESS))
      .catch(err => {
        if (err.name === SKIP_TRIGGER_NAME) {
          // trigger ignored by app configuration
          res.send(ECHO_SKIP)
        } else {
          // logger.error(err)
          // request to Store API with error response
          // return error status code
          res.status(500)
          let { message } = err
          res.send({
            error: ECHO_API_ERROR,
            message
          })
        }
      })
  }
}

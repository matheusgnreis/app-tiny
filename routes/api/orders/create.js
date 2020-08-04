const parseStatus = require('./../../../lib/ecomplus/parse-orders-status')

module.exports = ({ appSdk, ecomClient, mysql }) => {
  return (req, res) => {
    const body = req.body
    const storeId = req.storeId

    if (!storeId || !sessionToken) {
      return res.status(406).send({
        status: 406,
        message: 'Store id ou token inválidos, acesse essa página via admin https://admin.e-com.plus'
      })
    }

    if (!body ||
      !Array.isArray(body) ||
      !body.length) {
      return res.status(406).send({
        status: 400,
        message: 'Payload precisa ser um array de _id`s'
      })
    }

    return appSdk.getAuth(storeId).then(({ auth }) => {
      const promises = []
      for (let i = 0; i < body.length; i++) {
        const promise = mysql.fetchOrders(body[i], storeId).then(async row => {
          const resp = {
            _id: body[i]
          }

          if (!row || !row.length) {
            return ecomClient.store({
              url: `orders/${body[i]}.json`,
              storeId,
              authenticationId: auth.myId,
              accessToken: auth.accessToken
            }).then(({ data }) => {
              const financialStatus = data.financial_status ? data.financial_status.current : null
              return mysql.insertOrders(storeId, data._id, financialStatus, parseStatus(financialStatus), data.number, null, 'ecom')
            }).then(result => {
              resp.success = true
              resp.insertId = result.insertId
              return resp
            })
          }

          resp.success = false
          resp.message = String(`Pedido ${body[i]} já se encontra sincronizado.`)
          return resp
        })

        promises.push(promise)
      }

      return Promise.all(promises)
    }).then(resp => {
      return res.send(resp)
    }).catch(err => {
      console.log(err)
      const { response, message } = err
      const status = response && response.status || 500
      return res.status(status).send({
        status,
        message
      })
    })
  }
}
module.exports = ({ appSdk, ecomClient, getAppConfig, mysql }) => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id'), 10)
    const sessionToken = req.get('s-token')
    const body = req.body

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

    // valida token

    return getAppConfig({ appSdk, storeId }, true).then(async appConfig => {
      const promises = []
      for (let i = 0; i < body.length; i++) {
        const promise = ecomClient.store({
          url: `/products/${body[i]}.json`
        }).then(({ data }) => {
          return mysql.fetchProduct(data.sku, storeId).then(productDb => ({ productDb, data }))
        }).then(({ productDb, data }) => {
          const { _id, name, sku, price, variations, quantity } = data
          const resp = {
            _id,
            sku
          }

          if (!productDb.length) {
            return mysql.insertProduct(sku, storeId, _id, null, name, price, quantity)
              .then(rowProducts => {
                console.log('>> Produto salvo', storeId, sku)
                resp.insertId = rowProducts.insertId
                if (variations) {
                  return mysql.insertVariations(variations, _id, sku, storeId)
                    .then(rowsVariations => {
                      console.log('>> variações salvas', storeId, sku)
                      resp.variations = rowsVariations.map(row => row.insertId)
                      return resp
                    })
                }
                return resp
              })
          }

          resp.success = false
          resp.message = String(`Produto ${sku} existente no banco de dados, exclua se quiser sincronizá-lo novamente.`)
          return resp
        })

        promises.push(promise)
      }

      return Promise.all(promises)
    })
      .then(resp => {
        return res.send(resp)
      }).catch(err => {
        const { response, message } = err
        const status = response && response.status || 500
        return res.status(status).send({
          status,
          message
        })
      })
  }
}
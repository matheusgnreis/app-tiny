const jwt = require('jsonwebtoken')

module.exports = ({ appSdk, logger }) => {
  return (req, res) => {
    const storeId = parseInt(req.get('x-store-id'), 10)
    const applicationId = req.get('x-application-id')

    jwt.sign({
      auth: {
        storeId,
        applicationId
      }
    }, process.env.APPS_SECRET, { expiresIn: '1h' }, function (err, token) {
      console.log(err)
      if (err) {
        res.status(500)
        return res.send({
          err,
          message: 'Authentication failed'
        })
      }

      // save in application.hidden_data
      const url = `/applications/${applicationId}/hidden_data.json`
      appSdk.apiRequest(storeId, url, 'patch', {
        x_store_token: token
      }).then(() => {
        logger.log('Autenticação gerada para a store,', storeId,
          'Para o aplicativo', applicationId,
          'Expira em 1h')
        return res.send({ token })
      }).catch(err => {
        res.status(500)
        return res.send({
          err,
          message: 'Authentication failed'
        })
      })
    })
  }
}
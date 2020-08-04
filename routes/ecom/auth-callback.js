'use strict'

// log on files
const logger = require('console-files')

module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    // handle callback with E-Com Plus app SDK
    // https://github.com/ecomclub/ecomplus-app-sdk
    appSdk.handleCallback(storeId, req.body)

      .then(({ isNew }) => {
        if (isNew) {
          const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
          let secret = ''
          for (let i = 0; i < 32; i++) {
            secret += possible.charAt(Math.floor(Math.random() * possible.length))
          }

          // save in application.hidden_data
          const { application } = req.body
          const url = `/applications/${application._id}/hidden_data.json`
          appSdk.apiRequest(storeId, url, 'patch', {
            store_secret: secret
          }).then(() => {
            logger.log('Secret gerado com sucesso #,', secret, storeId)
            return res.send({ secret })
          })
        }
        // authentication tokens were updated
        res.status(204)
        res.end()
      })

      .catch(err => {
        if (typeof err.code === 'string' && !err.code.startsWith('SQLITE_CONSTRAINT')) {
          // debug SQLite errors
          logger.error(err)
        }
        res.status(500)
        let { message } = err
        res.send({
          error: 'auth_callback_error',
          message
        })
      })
  }
}

const getConfig = require(process.cwd() + '/lib/store-api/get-config')
module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    const body = req.body
    if (!Array.isArray(body) || body === null || !body.length) {
      return res.status(406).send('Invalid body')
    }
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        const appUnwatched = configObj.unwatched || []
        const payload = {
          unwatched: [
            ...appUnwatched,
            ...body
          ]
        }

        return require('../../lib/store-api/update-config')(appSdk, storeId, configObj, payload)

          .then(() => {
            res.status(204).end()
          })
      })
  }
}

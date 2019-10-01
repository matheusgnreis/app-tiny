const getConfig = require(process.cwd() + '/lib/store-api/get-config')
module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    const { id } = req.params
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        const appUnwatched = configObj.unwatched || []
        appUnwatched.splice(appUnwatched.indexOf(id), 1)
        const payload = {
          unwatched: [
            ...appUnwatched
          ]
        }

        return require('../../lib/store-api/update-config')(appSdk, storeId, configObj, payload)

          .then(() => {
            res.status(204).end()
          })
      })
  }
}

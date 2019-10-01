const getConfig = require(process.cwd() + '/lib/store-api/get-config')
module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    getConfig({ appSdk, storeId }, true)

      .then(configObj => {
        const { unwatched } = configObj

        res.send(unwatched)
      })
  }
}

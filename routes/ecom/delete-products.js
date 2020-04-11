const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const { getProductById, deleteProduct } = require('./../../lib/database')
module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    const { id } = req.params

    getConfig({ appSdk, storeId }, true)
      .then(configObj => {
        return getProductById(id, storeId)

          .then(row => {
            if (row && row.length) {
              // apaga no banco de dados
              return deleteProduct(id, storeId)

                .then(() => {
                  // salva no hidden data para não ser sincronizado novamente
                  const unwatched = []
                  unwatched.push(id)

                  const appUnwatched = configObj.unwatched || []
                  const body = {
                    unwatched: [
                      ...appUnwatched,
                      ...unwatched
                    ]
                  }

                  return require('../../lib/store-api/update-config')(appSdk, storeId, configObj, body)

                    .then(() => {
                      res.status(204).end()
                    })
                })

              // 204
            } else {
              res.status(404).send({
                'status': 404,
                'message': 'Resource ID on URL is invalid for this store',
                'user_message': {
                  'en_us': 'Nothing found, verify the specified ID',
                  'pt_br': 'Nada encontrado, verifique o ID especificado'
                }
              })
            }
          })
      })

      .catch(e => {
        res.status(500).send(e.message)
      })
  }
}

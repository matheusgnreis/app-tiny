const { getProductById } = require('./../../lib/database')
module.exports = appSdk => {
  return (req, res) => {
    const { storeId } = req
    const { id } = req.params

    getProductById(id, storeId)

      .then(row => {
        if (row && row.length) {
          res.send(row[0])
        } else {
          res.status(404).send({
            'status': 404,
            'message': 'Not found',
            'user_message': {
              'en_us': 'No results were found for the requested resource and ID',
              'pt_br': 'Nenhum resultado foi encontrado para o recurso e ID solicitado'
            }
          })
        }
      })

      .catch(e => {
        res.status(500).send(e.message)
      })
  }
}

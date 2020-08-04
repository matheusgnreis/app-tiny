
module.exports = ({ appSdk, ecomClient, getAppConfig, mysql }) => {
  return async (req, res) => {
    const productId = req.params.id
    const storeId = parseInt(req.get('x-store-id'), 10)
    const sessionToken = req.get('s-token')

    if (!storeId || !sessionToken) {
      return res.status(406).send({
        status: 406,
        message: 'Store id ou token inválidos, acesse essa página via admin https://admin.e-com.plus'
      })
    }

    if (!productId) {
      res.status(400).send({
        status: 400,
        message: 'Id do produto não informado'
      })
    }

    const sql = 'select * from products WHERE id = ? AND store_id = ? limit 1'
    const values = [productId, storeId]
    await mysql.query(sql, values).then(async rows => {
      if (!rows || !rows.length) {
        res.status(404)
        return res.send({
          status: 404,
          message: 'Recurso não encontrado, verifique se o :id informado está correto.'
        })
      }

      const deleteQuery = 'delete from products where id = ? and store_id = ?'
      return mysql.query(deleteQuery, values).then(() => {
        // exclui variations?
        const delVariations = 'delete from variations where parent_id = ? and store_id = ?'
        return mysql.query(delVariations, [rows[0].ecomplus_id, storeId])
      }).then(() => {
        return res.status(204).end()
      })
    })
      .catch(err => {
        return res.status(500).send({
          message: 'Erro inesperado, tente novamente mais tarde.',
          err
        })
      })
  }
}
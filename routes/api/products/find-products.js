
module.exports = ({ appSdk, ecomClient, getAppConfig, mysql }) => {
  return (req, res) => {
    const productId = req.params.id
    const storeId = parseInt(req.get('x-store-id'), 10)
    const sessionToken = req.get('s-token')

    if (!storeId || !sessionToken) {
      return res.status(406).send({
        status: 406,
        message: 'Store id ou token inválidos, acesse essa página via admin https://admin.e-com.plus'
      })
    }

    if (productId) {
      const sql = 'select * from products WHERE id = ? AND store_id = ? limit 1'
      const values = [productId, storeId]
      return mysql.query(sql, values).then(async rows => {
        const product = rows[0]
        if (!rows || !rows.length) {
          res.status(404)
          return res.send({
            status: 404,
            message: 'Recurso não encontrado, verifique se o :id informado está correto.'
          })
        }


        const sqlVariations = 'select * from variations where parent_id = ? and store_id = ?'
        await mysql.query(sqlVariations, [product.ecomplus_id, storeId]).then(row => {
          if (row && row.length) {
            product.variations = row
          }
        })

        return product
      })
        .then(product => res.send(product))
    }

    // pesquisa por criterios ou retorna todos
    let sql = 'select * from products ' +
      'where store_id = ? '
    const values = [storeId]
    const { query } = req

    if (query.ecomplus_id) {
      sql += 'and ecomplus_id = ? '
      values.push(query.ecomplus_id)
    }

    if (query.tiny_id) {
      sql += 'and tiny_id = ? '
      values.push(query.tiny_id)
    }

    if (query.sku) {
      sql += 'and sku = ? '
      values.push(query.sku)
    }

    if (query.title) {
      sql += 'and title = ? '
      values.push(query.title)
    }

    if (query.error) {
      sql += 'and error = ? '
      values.push(parseInt(query.error))
    }

    mysql.query(sql, values).then(row => {
      console.log(row)
      res.send(row)
    })
    .catch(err => {
      return res.status(500).send('Erro inesperado, tente novamente mais tarde.')
    })
  }
}
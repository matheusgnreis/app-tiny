'use strict'
const logger = require('console-files')
const { store } = require('@ecomplus/client')
const Tiny = require('./tiny/client')
const getConfig = require(process.cwd() + '/lib/store-api/get-config')
const {
  fetchProduct,
  fetchVariations,
  updateProduct,
  updateVariations
} = require('./database')

module.exports = ({ appSdk, db }) => {
  const sql = 'SELECT store_id FROM ecomplus_app_auth ORDER BY created_at DESC LIMIT 1'
  // run query and get each row object
  db.each(sql, (err, row) => {
    // busca todos os produtos que tiveram seus estoque
    // alterados nas ultimos 5m
    // e atualiza na ecomplus
    if (!err) {
      const storeId = row.store_id
      getConfig({ appSdk, storeId }, true)

        .then(configObj => {
          // tiny
          const tiny = new Tiny(configObj.access_token)
          const data = new Date()
          const year = data.getFullYear()
          const month = (`00${data.getMonth() + 1}`).slice(-2)
          const day = (`00${data.getDate()}`).slice(-2)
          const period = `${day}/${month}/${year}`

          appSdk.getAuth(storeId)

            .then(({ myId, accessToken }) => {
              tiny.fetchStockUpdate(period)

                .then(result => {
                  const { retorno } = result.data
                  const { produtos, status_processamento } = retorno

                  if (parseInt(status_processamento) === 3) {
                    if (produtos.length) {
                      // verifica se o produto o saldo
                      // do produto é diferente do banco
                      produtos.forEach(async produto => {
                        const saldo = produto.produto.saldo
                        const sku = produto.produto.codigo
                        let promise = null
                        let update = null

                        // ecomplus config
                        const options = {
                          storeId,
                          authenticationId: myId,
                          accessToken,
                          method: 'patch',
                          data: { quantity: saldo }
                        }

                        // produto ou variação?
                        let find = await fetchProduct(sku, storeId)

                        // produto
                        if (find && find.length) {
                          const qty = find[0].quantity || 0
                          if (qty !== saldo) {
                            options.url = `/products/${find[0].ecomplus_id}.json`
                            promise = store(options)
                            update = updateProduct(sku, storeId, saldo, 'tiny')
                          }
                        } else {
                          // variação
                          find = await fetchVariations(sku, storeId)
                          const qty = find[0].quantity || 0
                          if (qty !== saldo) {
                            options.url = `/products/${find[0].parent_id}/variations/${find[0]._id}.json`
                            promise = store(options)
                            update = updateVariations(sku, storeId, saldo, 'tiny')
                          }
                        }

                        if (promise) {
                          promise.then(update).catch(e => console.log('ERRRRR', e))
                        }
                      })
                    }
                  }
                })
            })
        })

        .catch(e => {
          logger.log('GET_APP_CONFIG_ERR', e)
        })
    } else {
      logger.error('SYNC_STOCK_ECOM_ERR', err)
      throw err
    }
  })
}

'use strict'
const ecomClient = require('@ecomplus/client')
const db = require('../database')
const TinySchema = require('../schemas/ecomplus-to-tiny')
const logger = require('console-files')

module.exports = async (storeId, idsList, configObj) => {
  return new Promise((resolve) => {
    const sync = (result) => {
      const promises = []
      const transactions = []
      const unwatched = configObj.unwatched || []

      for (let i = 0; i < result.length; i++) {
        // produto excluido da sincronização?
        if (unwatched.indexOf(result[i]._id || result[i]) === -1) {
          const url = `/products/${(result[i]._id || result[i])}.json`
          const promise = ecomClient
            .store({ url, storeId })
            .then(({ data }) => db.fetchProduct(data.sku, storeId)
              .then(row => {
                if (!row.length) {
                  return db.insertProduct(data.sku, storeId, data._id, null, data.name, data.price, data.quantity, 'ecomplus', data.variations)
                    .then(result => {
                      transactions.push(TinySchema(data, result.insertId))
                      if (data.variations) {
                        db.insertVariations(data.variations, data._id, data.sku, storeId)
                      }
                    })
                }
              }))
            .catch(e => logger.error('ECOMPLUS_API_ERR', e))
          //
          promises.push(promise)
        }
      }

      Promise.all(promises).then(() => resolve(transactions))
    }

    if (idsList && idsList.length) {
      sync(idsList)
    } else {
      ecomClient.store({ url: '/products.json', storeId })

        .then(({ data }) => {
          const { result } = data
          if (result && result.length) {
            sync(result)
          }
        })

        .catch(e => logger.error('ECOMPLUS_API_ERR', e))
    }
  })
}

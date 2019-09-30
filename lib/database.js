'use strict'

const mysql = require('mysql')
const logger = require('console-files')

const TB_PRODUCTS = 'products'
const TB_VARIATIONS = 'variations'
const TB_ORDERS = 'orders'

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  insecureAuth: true
})

const query = (sql, values) => {
  return new Promise((resolve, reject) => {
    pool.query(sql, values, (error, results) => {
      if (error) {
        logger.error('--> [MYSQL QUERY]', error)
        reject(error)
      }
      resolve(results)
    })
  })
}

module.exports = {
  pool,
  query,
  fetchProduct: (sku, storeId) => {
    const sql = `SELECT * FROM ${TB_PRODUCTS} WHERE sku = ? AND store_id = ?`
    const values = [sku, storeId]
    return query(sql, values)
  },
  getProductById: (_id, storeId) => {
    const sql = `SELECT * FROM ${TB_PRODUCTS} WHERE ecomplus_id = ? AND store_id = ?`
    const values = [_id, storeId]
    return query(sql, values)
  },
  updateProductQty: (sku, storeId, quantity, lastChangeBy) => {
    const sql = `UPDATE ${TB_PRODUCTS} SET quantity = ?, last_change_by = ? WHERE sku = ? AND store_id = ?`
    const values = [quantity, lastChangeBy, sku, storeId]
    return query(sql, values)
  },
  updateProduct: (storeId, tinyId, ecomplusId, sku, price, title, quantity, lastChangeBy = 'ecomplus') => {
    const sql = `UPDATE ${TB_PRODUCTS} SET tiny_id = ?, sku = ?, title = ?, price = ?, quantity = ?, last_change_by = ? WHERE ecomplus_id = ? AND store_id = ?`
    const values = [tinyId, sku, title, price, quantity, lastChangeBy, ecomplusId, storeId]
    return query(sql, values)
  },
  fetchVariations: (sku, storeId) => {
    const sql = `SELECT * FROM ${TB_VARIATIONS} WHERE sku = ? AND store_id = ?`
    const values = [sku, storeId]
    return query(sql, values)
  },
  updateVariations: (sku, storeId, quantity, lastChangeBy) => {
    const sql = `UPDATE ${TB_VARIATIONS} SET quantity = ?, last_change_by = ? WHERE sku = ? AND store_id = ?`
    const values = [quantity, lastChangeBy, sku, storeId]
    return query(sql, values)
  },
  updateTinyIdProduct: (id, productId) => {
    const sql = `UPDATE ${TB_PRODUCTS} SET tiny_id = ? WHERE id = ?`
    const values = [productId, id]
    return query(sql, values)
  },
  updateTinyIdOrder: (id, orderNumber, storeId) => {
    const sql = `UPDATE ${TB_ORDERS} SET tiny_id = ? WHERE order_number = ? AND store_id = ?`
    const values = [id, orderNumber, storeId]
    return query(sql, values)
  },
  updateSituacao: (collum, storeId, id, situacao, changeBy) => {
    const sql = `UPDATE ${TB_ORDERS} SET ${collum} = ?, last_change_by = ? WHERE store_id = ? AND _id = ?`
    const values = [situacao, changeBy, storeId, id]
    return query(sql, values)
  },
  insertProduct: (sku, storeId, ecomplusId, tinyId, title, price, quantity, lastChangeBy) => {
    const sql = `INSERT INTO ${TB_PRODUCTS} (ecomplus_id, tiny_id, sku, title, price, quantity, store_id, last_change_by) VALUES (?,?,?,?,?,?,?,?)`
    const values = [ecomplusId, tinyId, sku, title, price, quantity, storeId, lastChangeBy]
    return query(sql, values)
  },
  // orders
  fetchOrders: (id, storeId) => {
    const sql = `SELECT * FROM ${TB_ORDERS} WHERE _id = ? AND store_id = ?`
    const values = [id, storeId]
    return query(sql, values)
  },
  insertOrders: (storeId, id, ecomStatus, tinyStatus, orderNumber, tinyId, lastChangeBy) => {
    const sql = `INSERT INTO ${TB_ORDERS} (store_id, _id, ecom_status, tiny_status, order_number, tiny_id, last_change_by) VALUES (?,?,?,?,?,?,?)`
    const values = [storeId, id, ecomStatus, tinyStatus, orderNumber, tinyId, lastChangeBy]
    return query(sql, values)
  },
  insertVariations: (variations, parentId, parentSku, storeId) => {
    const sql = `INSERT INTO ${TB_VARIATIONS} (_id, sku, title, quantity, store_id, parent_sku, parent_id, last_change_by) VALUES (?,?,?,?,?,?,?,?)`
    if (variations.length) {
      variations.forEach(variation => {
        const values = [
          variation._id,
          variation.sku,
          variation.name,
          variation.quantity,
          storeId,
          parentSku,
          parentId,
          'ecomplus'
        ]
        query(sql, values)
      })
    }
  },
  deleteProduct: (id, storeId) => {
    return query(`DELETE FROM ${TB_PRODUCTS} WHERE ecomplus_id = ? AND store_id = ?`, [id, storeId])
  }
}

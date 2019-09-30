const axios = require('axios')
const instance = axios.create({
  baseURL: 'https://api.tiny.com.br/api2/',
  timeout: 60 * 1000
})

const addProducts = require('./save-products')
const fetchProducts = require('./fetch-products')
const fetchStock = require('./fetch-stock')
const addOrders = require('./save-orders')
const updateSituacao = require('./update-situacao')
const updateProducts = require('./update-product')
const updateStock = require('./update-stock')
const fetchStockUpdate = require('./list-update')

const Tiny = function (token) {
  this.config = {
    method: 'POST',
    params: {
      formato: 'JSON',
      token: token
    }
  }

  this.request = instance

  if (!token) {
    throw new Error('Tiny token not found')
  }

  const self = this
  this.addProducts = body => addProducts(self, body)
  this.fetchProducts = id => fetchProducts(self, id)
  this.fetchStock = id => fetchStock(self, id)
  this.addOrders = body => addOrders(self, body)
  this.updateSituacao = (id, situacao) => updateSituacao(self, id, situacao)
  this.updateProducts = body => updateProducts(self, body)
  this.updateStock = (id, qty) => updateStock(self, id, qty)
  this.fetchStockUpdate = periodo => fetchStockUpdate(self, periodo)
}

module.exports = Tiny

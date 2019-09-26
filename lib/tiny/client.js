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

// const t = new Tiny(access_token)

// let payload = { "produtos": [{ "produto": { "sequencia": 682, "nome": "Headset Gamer Corsair HS40 Raptor CA-9011122-NA(AP) Vinho", "codigo": "hd-csr-303", "unidade": "UN", "preco": 12, "origem": 0, "gtin": "", "peso_liquido": "", "estoque_atual": 6836, "situacao": "A", "tipo": "P", "marcas": "Corsair", "altura_embalagem": "", "largura_embalagem": "", "comprimento_embalagem": "", "anexos": [{ "anexo": "https://ecom-ptqgjveg.nyc3.digitaloceanspaces.com/imgs/400px/@1550850821727-embalagem-headset-gamer-corsair-raptor-hs40.jpg" }, { "anexo": "https://ecom-ptqgjveg.nyc3.digitaloceanspaces.com/imgs/400px/@1550850822666-headset-gamer-corsair-raptor-hs40-ca9011122na.jpg" }, { "anexo": "https://ecom-ptqgjveg.nyc3.digitaloceanspaces.com/imgs/400px/@1550850827637-corsair-raptor-hs40-ca9011122na.jpg" }], "variacoes": [{ "variacao": { "codigo": "hd-csr-303-555-1", "preco": 232, "estoque_atual": 300, "grade": { "metragem_do_cabo": "1", "colors": "Vermelho", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-834-2", "preco": 232, "estoque_atual": 1287, "grade": { "metragem_do_cabo": "1", "colors": "Vermelho", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-659-3", "preco": 232, "estoque_atual": 80, "grade": { "metragem_do_cabo": "1", "colors": "Azul", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-138-4", "preco": 232, "estoque_atual": 123, "grade": { "metragem_do_cabo": "1", "colors": "Azul", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-385-5", "preco": 232, "estoque_atual": 423, "grade": { "metragem_do_cabo": "1", "colors": "Branco", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-867-6", "preco": 232, "estoque_atual": 2423, "grade": { "metragem_do_cabo": "1", "colors": "Branco", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-240-7", "preco": 232, "estoque_atual": 13, "grade": { "metragem_do_cabo": "1", "colors": "Roxo", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-223-8", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "1", "colors": "Roxo", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-994-9", "preco": 232, "estoque_atual": 187, "grade": { "metragem_do_cabo": "1", "colors": "Verde", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-319-10", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "1", "colors": "Verde", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-368-11", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Vermelho", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-307-12", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Vermelho", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-630-13", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Azul", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-760-14", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Azul", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-188-15", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Branco", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-280-16", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Branco", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-362-17", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Roxo", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-692-18", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Roxo", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-831-19", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Verde", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-452-20", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "5", "colors": "Verde", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-256-21", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Vermelho", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-271-22", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Vermelho", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-549-23", "preco": 232, "estoque_atual": 1000, "grade": { "metragem_do_cabo": "2", "colors": "Azul", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-945-24", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Azul", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-403-25", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Branco", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-417-26", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Branco", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-484-27", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Roxo", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-553-28", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Roxo", "conector": "P2" } } }, { "variacao": { "codigo": "hd-csr-303-978-29", "preco": 232, "estoque_atual": 1000, "grade": { "metragem_do_cabo": "2", "colors": "Verde", "conector": "USB" } } }, { "variacao": { "codigo": "hd-csr-303-256-30", "preco": 232, "estoque_atual": 0, "grade": { "metragem_do_cabo": "2", "colors": "Verde", "conector": "P2" } } }] } }] }

// t.fetchProducts(511081866).then(r => console.log('REEES', r.data)).catch(e => console.log('errrrr', e.data))

// t.addProducts(payload).then(r => console.log('FOI', r.data))

module.exports = Tiny

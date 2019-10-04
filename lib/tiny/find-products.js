module.exports = (self, sku) => {
  self.config.url = 'produtos.pesquisa.php'
  self.config.params.pesquisa = sku
  return self.request(self.config)
}

module.exports = (self, orderNumber) => {
  self.config.url = 'pedidos.pesquisa.php'
  self.config.params.numeroEcommerce = orderNumber
  return self.request(self.config).then(res => res.data)
}

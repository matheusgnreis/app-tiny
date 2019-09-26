module.exports = async (self, body) => {
  self.config.url = 'pedido.incluir.php'
  self.config.params.pedido = JSON.stringify(body)
  return self.request(self.config)
}

module.exports = (self, id) => {
  self.config.url = 'pedido.obter.php'
  self.config.params.id = id
  return self.request(self.config)
}

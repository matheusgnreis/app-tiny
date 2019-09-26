module.exports = (self, id) => {
  self.config.url = 'produto.obter.estoque.php'
  self.config.params.id = id
  return self.request(self.config)
}

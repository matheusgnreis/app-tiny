module.exports = (self, id) => {
  self.config.url = 'produto.obter.php'
  self.config.params.id = id
  return self.request(self.config)
}

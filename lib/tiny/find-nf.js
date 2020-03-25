module.exports = (self, id) => {
  self.config.url = 'nota.fiscal.obter.php'
  self.config.params.id = id
  return self.request(self.config)
}

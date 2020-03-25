module.exports = (self, id) => {
  self.config.url = 'nota.fiscal.obter.link.php'
  self.config.params.id = id
  return self.request(self.config)
}

module.exports = async (self, body) => {
  const payload = {
    produtos: [body]
  }
  self.config.url = 'produto.alterar.php'
  self.config.params.produto = JSON.stringify(payload)
  return self.request(self.config)
}

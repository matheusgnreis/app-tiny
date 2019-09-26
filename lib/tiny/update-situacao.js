module.exports = async (self, id, situacao) => {
  self.config.url = 'pedido.alterar.situacao'
  self.config.params.id = id
  self.config.params.situacao = situacao
  return self.request(self.config)
}

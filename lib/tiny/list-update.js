module.exports = (self, periodo) => {
  self.config.url = 'lista.atualizacoes.estoque'
  self.config.params.dataAlteracao = periodo
  return self.request(self.config)
}

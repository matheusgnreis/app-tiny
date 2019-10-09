module.exports = (self, start, end) => {
  self.config.url = 'pedidos.pesquisa.php'
  self.config.params.dataInicialOcorrencia = start
  self.config.params.dataFinalOcorrencia = end
  return self.request(self.config)
}

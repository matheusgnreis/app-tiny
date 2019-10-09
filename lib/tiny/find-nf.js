module.exports = (self, id) => {
  self.config.url = 'nota.fiscal.obter.php'
  self.config.params.id = id
  return self.request(self.config).then(result => {
    const { retorno } = result.data
    const { nota_fiscal, status_processamento } = retorno
    if (parseInt(status_processamento) === 3) {
      return nota_fiscal
    } else {
      // erro return empty
      return null
    }
  })
}

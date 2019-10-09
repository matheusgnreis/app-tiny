module.exports = (self, id) => {
  self.config.url = 'nota.fiscal.obter.link.php'
  self.config.params.id = id
  return self.request(self.config).then(result => {
    const { retorno } = result.data
    const { link_nfe, status_processamento } = retorno
    if (parseInt(status_processamento) === 3) {
      return link_nfe
    } else {
      // erro return empty
      return null
    }
  })
}

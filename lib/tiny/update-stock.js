module.exports = async (self, id, qty) => {
  const payload = {
    estoque: {
      idProduto: id,
      quantidade: qty
    }
  }
  self.config.url = 'produto.atualizar.estoque.php'
  self.config.params.estoque = JSON.stringify(payload)
  return self.request(self.config)
}

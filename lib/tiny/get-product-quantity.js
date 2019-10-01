module.exports = (tiny, productId) => tiny.fetchStock(productId)
  .then(result => {
    const { retorno } = result.data
    const { codigo_erro, status, status_processamento, produto } = retorno
    if (parseInt(status_processamento) === 3) {
      const { saldo } = produto
      return saldo
    } else if (parseInt(status_processamento) < 3 && status === 'Erro') {
      if (!isNaN(parseInt(codigo_erro)) && parseInt(codigo_erro) === 6) {
        // to many requests
        console.log('[getQuantity] many request')
        setTimeout(() => {
          // try again
          return this
        }, 60000)
      }
    } else {
      return 0
    }
  })

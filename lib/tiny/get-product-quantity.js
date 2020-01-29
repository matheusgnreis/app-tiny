const logger = require('console-files')

module.exports = (tiny, productId) => tiny.fetchStock(productId)
  .then(result => {
    logger.log(`Search for variations -> ${productId} stock`)
    const { retorno } = result.data
    const { codigo_erro, status, status_processamento, produto } = retorno
    if (parseInt(status_processamento) === 3) {
      const { saldo } = produto
      logger.log(`Stock total -> ${saldo}`)
      return saldo
    } else if (parseInt(status_processamento) < 3 && status === 'Erro') {
      if (!isNaN(parseInt(codigo_erro)) && parseInt(codigo_erro) === 6) {
        // to many requests
        logger.log('[!] Many request, waiting 1m')
        setTimeout(() => {
          // try again
          return this
        }, 60000)
      }
    } else {
      return 0
    }
  })

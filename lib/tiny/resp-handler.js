'use strict'

module.exports = (resp) => {
  const { retorno } = resp.data
  const { registros, produtos, pedidos } = retorno

  const status = parseInt(retorno.status_processamento)
  const erroCode = parseInt(retorno.codigo_erro)
  const response = {
    retorno
  }

  if (status === 3) {
    // response with registros in body
    if (registros && Array.isArray(registros)) {
      response.registro = registros[0].registro
    } else if (registros && typeof registros === 'object' && registros.registro) {
      response.registro = registros.registro
    }

    // response with produtos in body
    if (produtos && Array.isArray(produtos)) {
      response.produto = produtos[0].produto
      response.produtos = produtos.map(produto => produto.produto)
    }

    // response with pedido in body
    if (pedidos && Array.isArray(pedidos)) {
      response.pedido = pedidos[0].pedido
      response.pedidos = pedidos.map(pedido => pedido.pedido)
    }

    if (retorno.nota_fiscal) {
      response.notaFiscal = retorno.nota_fiscal
    }

    if (retorno.link_nfe) {
      response.notaFiscalLink = retorno.link_nfe
    }

    response.success = true
  } else {
    const erro = {}
    if (erroCode === 6) {
      // api request limit
      erro.code = 4290
      erro.message = 'Api request limit'
    } else if (erroCode === 20) {
      erro.code = 4004
      erro.message = 'Nenhum registro para a busca'
    } else {
      // body erro
      if (Array.isArray(registros)) {
        const { registro } = registros[0]
        const { erros } = registro

        if (parseInt(registro.codigo_erro) === 31) {
          // missing fields or something
          erro.code = 4000
          erro.message = Array.isArray(erros) ? erros[0].erro : 'Check the body of the request'
        } else if (parseInt(registro.codigo_erro) === 30) {
          // duplicated
          erro.code = 3000
          erro.message = Array.isArray(erros) ? erros[0].erro : 'Item duplicated'
        }
      } else if (typeof registros === 'object' && registros.registro) {
        const { registro } = registros
        if (parseInt(registro.codigo_erro) === 31) {
          // missing fields or something
          erro.code = 4000
          erro.message = registro && registro.erros ? registro.erros.erro : 'Check the body of the request'
        } else if (parseInt(registro.codigo_erro) === 30) {
          // duplicated
          erro.code = 3000
          erro.message = registro && registro.erros ? registro.erros.erro : 'Item duplicated'
        }
      }
    }

    response.retorno = retorno
    response.error = {
      erro
    }
  }

  return response
}

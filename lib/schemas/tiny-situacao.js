module.exports = status => {
  switch (status) {
    case 'Em aberto': return 'aberto'
    case 'Aprovado': return 'aprovado'
    case 'Faturado (atendido)': return 'faturado'
    case 'Pronto para envio': return 'pronto_envio'
    case 'Enviado': return 'enviado'
    case 'Entregue': return 'entregue'
    case 'Cancelado': return 'cancelado'
    default: break
  }
}

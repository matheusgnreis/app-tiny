module.exports = status => {
  switch (status) {
    case 'pending':
    case 'under_analysis':
    case 'unknown':
    case 'partially_paid':
    case 'authorized':
      return 'aberto'
    case 'paid':
      return 'aprovado'
    case 'voided':
    case 'refunded':
    case 'in_dispute':
    case 'partially_refunded':
      return 'cancelado'
    default: return ''
  }
}

const { updateTinyIdProduct, updateTinyIdOrder } = require('./database')
const Tiny = require('./tiny/client')
const TinyTransactions = require('./tiny/transactions')

/**
 * handle callbacks from transaction events
 */
const callbacks = {
  pedido: (response, transaction, storeId) => {
    const { registro } = response
    if (registro) {
      const { id } = registro
      console.log('--> Pedido enviado', id)
      const orderNumber = transaction.pedido.numero_pedido_ecommerce
      // update tiny_id of order in database
      updateTinyIdOrder(id, orderNumber, storeId)
        .then(() => console.log('--> Id atualizado', id))
    }
  },
  produto: (data) => {
    const { registro } = data[0]
    if (registro) {
      const { sequencia, id } = registro
      console.log('--> Produto enviado', id)
      // update tiny_id of product in database
      updateTinyIdProduct(sequencia, id)
        .then(() => console.log('--> Id atualizado', id))
    }
  },
  erro: (err, transaction) => {
    console.error('--> Erro ->', err.message)
  },
  idle: queue => {
    console.log('\n')
    console.log('--> Idle for 1m')
    console.log('--> Fila', queue)
    console.log('\n')
  },
  status: (current, last, next, total) => {
    console.log('\n')
    console.log('--> Status')
    console.log('-> Ultimo', last)
    console.log('-> Atual', current)
    console.log('-> Proximo', next)
    console.log('-> Total', total)
    console.log('\n')
  }
}

/**
 * receive array of orders and products and send to tiny
 */
module.exports = async (configObj, transactions) => {
  return new Promise((resolve) => {
    const { access_token } = configObj
    const tiny = new Tiny(access_token)
    const tt = new TinyTransactions(tiny)

    // sync?
    if (transactions) {
      tt.start(transactions)

      tt.on('success', (data, current, type) => {
        callbacks[type](data, current, type)
      })

      tt.on('status', callbacks.status)
      tt.on('erro', callbacks.erro)
      tt.on('idle', callbacks.idle)
      tt.on('end', () => {
        resolve()
      })
    } else {
      resolve()
    }
  })
}

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
      const orderNumber = transaction.pedido.numero_pedido_ecommerce
      // update tiny_id of order in database
      updateTinyIdOrder(id, orderNumber, storeId)
        .then(() => {
          console.log('\n')
          console.log('--> Sucesso!')
          console.log('-> Pedido enviado', id)
          console.log('-> Id atualizado', id)
        })
    }
  },
  produto: (data) => {
    const { registro } = data[0]
    if (registro) {
      const { sequencia, id } = registro
      // update tiny_id of product in database
      updateTinyIdProduct(sequencia, id)
        .then(() => {
          console.log('\n')
          console.log('--> Sucesso!')
          console.log('-> Produto enviado', id)
          console.log('-> Id atualizado', id)
        })
    }
  },
  erro: (err) => {
    const { message, response } = err
    const { registro } = response[0]
    const { erros } = registro
    const errMessage = erros.length ? erros[0].erro : message

    console.log('\n')
    console.error('--> Error')
    console.error('->', errMessage)
  },
  idle: queue => {
    console.log('\n')
    console.log('--> Idle for 1m')
    console.log('-> Total na fila: ', queue)
  },
  status: (current, total) => {
    console.log('\n')
    console.log('--> Status')
    console.log('-> Atual:', current)
    console.log('-> Total:', total)
  }
}

/**
 * receive array of orders and products and send to tiny
 */
module.exports = async (configObj, transactions) => {
  return new Promise((resolve) => {
    const tiny = new Tiny(configObj.access_token)
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

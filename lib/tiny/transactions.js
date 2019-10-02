const emitter = require('../emitter')

const Transactions = function (tiny) {
  this.tiny = tiny
  this.retry = []
  this.queue = []
  this.current = 0
  this.retryCounter = 0
  this.type = null

  this.start = function (transactions) {
    this.queue = transactions
    this.run()
  }

  this.run = function () {
    if (this.queue[this.current]) {
      // transaction status
      emitter.emit('status', this.current, this.queue.length)

      for (const key in this.queue[this.current]) {
        if (this.queue[this.current].hasOwnProperty(key)) {
          this.type = key
        }
      }

      let fn = null

      switch (this.type) {
        case 'produto':
          fn = this.tiny.addProducts(this.queue[this.current])
          break
        case 'pedido':
          fn = this.tiny.addOrders(this.queue[this.current])
          break
        default: break
      }

      fn.then(response => this.handler(response, this.queue[this.current]))
        .catch(resp => {
          if (resp.status === 500) {
            this.retry.push(this.queue[this.current])
          }
        })
    } else if (!this.queue[this.current] && this.retry.length) {
      this.current = 0
      this.queue = this.retry
      this.run()
    } else {
      emitter.emit('end')
    }
  }

  this.handler = function (response, transaction) {
    const { retorno } = response.data
    const { status, registros, codigo_erro, status_processamento } = retorno

    if (retorno && parseInt(status_processamento) < 3) {
      if (status === 'Erro') {
        const err = {}
        if (!isNaN(parseInt(codigo_erro)) && parseInt(codigo_erro) === 6) {
          // to many requests
          emitter.emit('idle', this.queue.length - this.current)
          setTimeout(() => {
            // try again
            this.run()
          }, 60000)
        } else {
          // bad request
          // todo
          err.code = 4000
          err.message = 'Bad request'
          err.response = registros
          err.resource = this.type
          emitter.emit('erro', err, transaction)
          this.current++
          this.run()
        }
      }
    } else {
      // emitter
      const current = this.queue[this.current]
      emitter.emit('success', registros, current, this.type)
      this.current++
      this.run()
    }
  }

  const self = this
  // emitter
  ;['on', 'off', 'once'].forEach(method => {
    self[method] = (ev, fn) => {
      emitter[method](ev, fn)
    }
  })
}

module.exports = Transactions

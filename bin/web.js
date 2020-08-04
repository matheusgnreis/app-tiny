#!/usr/bin/env node

'use strict'

// log to files
const logger = require('console-files')
// handle app authentication to Store API
// https://github.com/ecomplus/application-sdk
const { ecomAuth, ecomServerIps } = require('@ecomplus/application-sdk')

// web server with Express
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const router = express.Router()
const port = process.env.PORT || 3003

const ecomClient = require('@ecomplus/client')
const getAppConfig = require('./../lib/store-api/get-config')
const mysql = require('./../lib/database')
const tinyClient = require('./../lib/tiny/api-client')

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

app.use(async (req, res, next) => {
  if (req.url.startsWith('/ecom/')) {
    // get E-Com Plus Store ID from request header
    req.storeId = parseInt(req.get('x-store-id'), 10)
    if (req.url.startsWith('/ecom/modules/')) {
      // request from Mods API
      // https://github.com/ecomclub/modules-api
      const { body } = req
      if (typeof body !== 'object' || body === null || !body.params || !body.application) {
        return res.status(406).send('Request not comming from Mods API? Invalid body')
      }
    }

    // on production check if request is comming from E-Com Plus servers
    if (process.env.NODE_ENV === 'production' && ecomServerIps.indexOf(req.get('x-real-ip')) === -1) {
      return res.status(403).send('Who are you? Unauthorized IP address')
    }
  }

  // pass to the endpoint handler
  // next Express middleware
  next()
})

ecomAuth.then(appSdk => {
  // setup app routes
  const routes = './../routes'
  router.get('/', require(`${routes}/`)())

  // base routes for E-Com Plus Store API
  ;['auth-callback'].forEach(endpoint => {
    const filename = `/ecom/${endpoint}`
    router.post(filename, require(`${routes}${filename}`)(appSdk))
  })

  /**
   rotas do app
    /produtos/ecom post
    /produtos/tiny post/get
    /produtos/tiny/:produtoId get/delete
    /pedidos/tiny post
   */
  const appParams = { appSdk, ecomClient, getAppConfig, mysql, logger, tinyClient }
  router.post('/api/products/ecom', require('../routes/api/products/ecom/create')(appParams))
  router.post('/api/products/tiny', require('./../routes/api/products/tiny/create')(appParams))
  router.get('/api/products', require('./../routes/api/products/find-products')(appParams))
  router.get('/api/products/:id', require('./../routes/api/products/find-products')(appParams))
  router.delete('/api/products/:id', require('./../routes/api/products/delete-products')(appParams))
  router.post('/api/orders/tiny', require('./../routes/api/orders/create')(appParams))
  router.post('/authenticate', require('./../routes/api/authenticate')(appParams))

  app.use(async (req, res, next) => {
    if (req.url.startsWith('/api/')) {
      // get E-Com Plus Store ID from request header
      req.storeId = parseInt(req.get('x-store-id'), 10)
      req.storeSecret = req.get('x-store-secret')

      if (!req.storeId || !req.storeSecret) {
        return res.status(406).send({
          status: 406,
          message: 'É obrigatório informar x-store-id e x-store-secret, acesse essa página via admin https://admin.e-com.plus'
        })
      }

      try {
        req.appConfig = await getAppConfig({ appSdk, storeId: req.storeId }, true)
      } catch (error) {
        return res.status(500).send({
          status: 500,
          message: 'Get appConfig error'
        })
      }

      if (req.appConfig.store_secret !== req.storeSecret || req.storeSecret.length !== 32) {
        return res.status(401).send({
          status: 401,
          message: 'X-Store-Secret inválido.'
        })
      }
    }

    // pass to the endpoint handler
    // next Express middleware
    next()
  })

  router.post('/ecom/webhook', require('./../routes/ecom/webhook')(appParams))
  // add router and start web server
  app.use(router)
  app.listen(port)
  logger.log(`--> Starting web app on port :${port}`)
})

ecomAuth.catch(err => {
  logger.error(err)
  setTimeout(() => {
    // destroy Node process while Store API auth cannot be handled
    process.exit(1)
  }, 1100)
})

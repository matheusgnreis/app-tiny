#!/usr/bin/env node

'use strict'

// log on files
const logger = require('console-files')
// handle app authentication to Store API
// https://github.com/ecomplus/application-sdk
const { ecomAuth } = require('@ecomplus/application-sdk')

const ecomClient = require('@ecomplus/client')
const mysql = require('./../lib/database')
const getStores = require('./../lib/get-stores')
const MapStores = require('./../lib/map-stores')
const tinyClient = require('./../lib/tiny/api-client')

logger.log('--> Start running daemon processes')

ecomAuth.then(appSdk => {
  // configure setup for stores
  // list of procedures to save
  const procedures = require('./../lib/store-api/procedures')
  if (procedures && procedures.length) {
    const { triggers } = procedures[0]
    if (triggers && triggers.length) {
      appSdk.configureSetup(procedures, (err, { storeId }) => {
        if (!err) {
          logger.log('--> Setup store #' + storeId)
        } else if (!err.appAuthRemoved) {
          logger.error(err)
        }
      })
    }
  }

  const params = { logger, ecomClient, mysql, getStores, MapStores, appSdk, tinyClient }
  require('./../lib/ecomplus/save-products-db')(params)
  require('./../lib/ecomplus/sync-products-with-tiny')(params)

  // orders
  require('./../lib/ecomplus/save-orders-db')(params)
  require('./../lib/ecomplus/sync-orders-with-tiny')(params)

  // stock manager
  require('./../lib/tiny/stock-manager')(params)
  require('./../lib/tiny/orders-manager')(params)
})

ecomAuth.catch(err => {
  logger.error(err)
  setTimeout(() => {
    // destroy Node process while Store API auth cannot be handled
    process.exit(1)
  }, 1000)
})

/* Run other app background processes here */

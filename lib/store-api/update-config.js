'use strict'

module.exports = (appSdk, storeId, applicationId) => {
  return (body) => {
    const resource = `/applications/${applicationId}/hidden_data.json`
    const method = 'PATCH'
    const bodyUpdate = {
      last_sync: body
    }

    return appSdk.apiRequest(storeId, resource, method, bodyUpdate)
  }
}

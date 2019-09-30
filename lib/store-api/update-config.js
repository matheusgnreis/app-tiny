'use strict'
module.exports = (appSdk, storeId, objConfig, body) => {
  const applicationId = objConfig.application_id
  const resource = `/applications/${applicationId}/hidden_data.json`
  const method = 'PATCH'
  return appSdk.apiRequest(storeId, resource, method, body)
}

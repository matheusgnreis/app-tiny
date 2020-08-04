const axios = require('axios')
const instance = axios.create({
  baseURL: 'https://api.tiny.com.br/api2/',
  timeout: 30 * 1000,
  method: 'post',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'cache-control': 'no-cache'
  }
})
const parseResponse = require('./parse-resp')

module.exports = ({ url, data, params, token }, parseResp) => {
  return instance({
    url,
    data,
    params: {
      ...params,
      token: token,
      formato: 'JSON'
    }
  }).then(resp => {
    if (parseResp) {
      return parseResponse(resp)
    }

    return resp
  })
}

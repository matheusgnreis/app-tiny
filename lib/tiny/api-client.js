const axios = require('axios')
const formData = require('form-data')

const instance = axios.create({
  baseURL: 'https://api.tiny.com.br/api2/',
  method: 'post',
  headers: {
    'cache-control': 'no-cache'
  }
})

const parseResponse = require('./parse-resp')

module.exports = ({ url, data, params, token, isForm }, parseResp) => {
  let req
  if (isForm && isForm === true) {
    const form = new formData()
    const param = url.split('.')
    form.append('token', token)
    form.append('formato', 'json')
    form.append(param[0], data)
    req = instance({
      url,
      method: 'post',
      headers: {
        ...form.getHeaders()
      },
      data: form
    })
  } else {
    req = instance({
      url,
      data,
      params: {
        ...params,
        token: token,
        formato: 'JSON'
      }
    })
  }

  return req.then(resp => {
    if (parseResp) {
      return parseResponse(resp)
    }

    return resp
  })
}

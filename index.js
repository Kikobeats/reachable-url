'use strict'

const pReflect = require('p-reflect')
const pTimeout = require('p-timeout')
const { URL } = require('url')
const pAny = require('p-any')
const got = require('got')

const createRequest = method => async (url, opts) => {
  const req = got[method](url, { encoding: null, retry: 0, ...opts })
  const redirectStatusCodes = []
  const redirectUrls = []

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { isFulfilled, value: response = {}, reason: error } = await pReflect(
    pTimeout(req, opts.timeout || Infinity)
  )

  return {
    isFulfilled,
    value: { ...response, redirectUrls, redirectStatusCodes },
    error
  }
}

const fromHEAD = createRequest('head')
const fromGET = createRequest('get')

module.exports = async (url, opts = {}) => {
  const { href: encodedUrl } = new URL(url)
  const { isFulfilled, value, error } = await pAny([
    fromHEAD(encodedUrl, opts),
    fromGET(encodedUrl, opts)
  ])
  return isFulfilled
    ? value
    : {
      redirectStatusCodes: [],
      redirectUrls: [],
      statusCode: error.statusCode || 404,
      headers: error.headers || {},
      statusMessage: error.statusMessage || 'Not Found',
      url: error.url || url
    }
}

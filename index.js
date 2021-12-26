'use strict'

const pReflect = require('p-reflect')
const { URL } = require('url')
const got = require('got')

const mergeResponse = (responseOrigin = {}, responseDestination = {}) => ({
  statusMessage: 'Not Found',
  statusCode: 404,
  headers: { ...responseOrigin.headers, ...responseDestination.headers },
  ...responseOrigin,
  ...responseDestination
})

const createFetcher = method => async (url, opts = {}) => {
  const req = got(url, {
    retry: 0,
    ...opts,
    decompress: false,
    responseType: 'buffer',
    method
  })

  const redirectStatusCodes = []
  const redirectUrls = []
  let response

  req.on('response', res => {
    response = res
    response.once('data', req.cancel)
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { isFulfilled, value, reason: error } = await pReflect(req)

  const mergedResponse = mergeResponse(isFulfilled ? value : error.response, response)

  return {
    url,
    ...mergedResponse,
    redirectUrls,
    redirectStatusCodes,
    requestUrl: url
  }
}

const createRequest = fetch => (url, opts) => fetch(url, opts)

const fromGET = createRequest(createFetcher('get'))

const isReachable = ({ statusCode }) => statusCode >= 200 && statusCode < 400

module.exports = async (url, opts = {}) => {
  const { href: encodedUrl } = new URL(url)
  return fromGET(encodedUrl, opts)
}

module.exports.isReachable = isReachable

'use strict'

const pReflect = require('p-reflect')
const pTimeout = require('p-timeout')
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
    responseType: 'buffer',
    method,
    retry: 0,
    ...opts
  })

  const redirectStatusCodes = []
  const redirectUrls = []
  let response

  req.on('response', res => {
    response = res
    res.destroy()
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { isFulfilled, value, reason: error } = await pReflect(
    pTimeout(req, opts.timeout || Infinity)
  )

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

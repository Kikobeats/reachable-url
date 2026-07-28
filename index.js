'use strict'

const pReflect = require('p-reflect')
const { URL } = require('url')

const got = require('got').extend({
  decompress: false,
  responseType: 'buffer',
  retry: 1,
  headers: {
    Range: 'bytes=0-0'
  },
  hooks: {
    beforeRetry: [
      options => {
        delete options.headers.range
      }
    ]
  }
})

const mergeResponse = (responseOrigin = {}, responseDestination = {}) => ({
  statusMessage: 'Not Found',
  statusCode: 404,
  headers: { ...responseOrigin.headers, ...responseDestination.headers },
  ...responseOrigin,
  ...responseDestination
})

const reachableUrl = async (url, opts) => {
  const req = got(url, opts)

  const redirectStatusCodes = []
  const redirectUrls = []
  let response

  req.on('response', res => {
    response = res

    // Range asks for a single byte. If the server honors it (206 + 1 byte),
    // allow that tiny body through. Otherwise abort so we do not buffer the
    // full entity — many servers ignore Range, and beforeRetry also strips it.
    const contentLength = Number(res.headers['content-length'])
    const isTinyPartial = res.statusCode === 206 && contentLength <= 1

    if (!isTinyPartial) {
      req.cancel()
    }
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { isFulfilled, value, reason: error } = await pReflect(req)

  // cacheable-request commits the cache entry on the next tick after cancel.
  if (!isFulfilled) {
    await new Promise(resolve => setImmediate(resolve))
  }

  const mergedResponse = mergeResponse(isFulfilled ? value : error.response, response)

  if (mergedResponse.statusCode === 206) {
    const contentRange = mergedResponse.headers['content-range']
    if (typeof contentRange === 'string') {
      let contentLength = contentRange.split('/')
      if (contentLength.length > 1) {
        contentLength = contentLength[contentLength.length - 1]
        mergedResponse.statusCode = 200
        mergedResponse.statusMessage = 'OK'
        mergedResponse.headers['content-length'] = contentLength
        mergedResponse.headers['content-range'] = undefined
      }
    }
  }

  return {
    url,
    ...mergedResponse,
    redirectUrls,
    redirectStatusCodes,
    requestUrl: url
  }
}

const isReachable = ({ statusCode }) => statusCode >= 200 && statusCode < 400

module.exports = async (url, opts) => {
  if (/^\/\//.test(url)) url = `https:${url}`
  return reachableUrl(new URL(url).href, opts)
}

module.exports.isReachable = isReachable

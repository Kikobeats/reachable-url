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

const honoredRange = res => res.statusCode === 206 && Number(res.headers['content-length']) <= 1

const isRetryable = res => res.statusCode >= 500 && res.statusCode < 600

// `Range: bytes=0-0` asks for one byte, but a server is free to ignore it and
// send the whole entity, which `responseType: 'buffer'` would then buffer in
// full. Cancelling drops the rest of it: the status and headers already answer
// whether the URL is reachable. Not when caching, because cacheable-request
// stores the entry on `end`, which a cancelled response never emits.
const shouldAbortDownload = (res, opts) => !opts?.cache && !honoredRange(res) && !isRetryable(res)

const reachableUrl = async (url, opts) => {
  const followRedirect = opts?.followRedirect ?? got.defaults.options.followRedirect
  const req = got(url, opts)

  const redirectStatusCodes = []
  const redirectUrls = []
  let response

  let abortedAt

  req.on('response', res => {
    response = res
    if (shouldAbortDownload(res, opts)) {
      abortedAt = Date.now()
      req.cancel()
    }
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { isFulfilled, value, reason: error } = await pReflect(req)

  const mergedResponse = mergeResponse(isFulfilled ? value : error.response, response)

  if (abortedAt !== undefined) {
    // A retried request carries the body of the attempt before it; the one that
    // was cancelled has none.
    mergedResponse.body = undefined
    // `phases.total` is filled on `end`, which a cancelled request never emits,
    // and the timer does not record the cancel either.
    const { timings } = mergedResponse
    if (timings?.phases.total === undefined) {
      timings.phases.total = abortedAt - timings.start
    }
  }

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
    followRedirect,
    redirectUrls,
    redirectStatusCodes,
    requestUrl: url
  }
}

// While following, a 3xx is the hop the follow stopped at, never the destination.
const isReachable = ({ statusCode, followRedirect = true }) =>
  statusCode >= 200 && statusCode < (followRedirect ? 300 : 400)

module.exports = async (url, opts) => {
  if (/^\/\//.test(url)) url = `https:${url}`
  return reachableUrl(new URL(url).href, opts)
}

module.exports.isReachable = isReachable

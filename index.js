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

const CACHE_ERROR = `The \`cache\` option needs @kikobeats/cacheable-request.

got resolved the unpatched cacheable-request@7, which never settles when the
origin keeps the connection alive, and no timeout recovers from it. Add the
override to your pnpm-workspace.yaml:

  overrides:
    got>cacheable-request: npm:@kikobeats/cacheable-request`

const loadCacheableRequest = () =>
  require(require.resolve('cacheable-request', { paths: [require.resolve('got')] }))

// The unpatched cacheable-request is a class exposing `createCacheableRequest`; the
// patched one is a plain factory function. Checking the shape rather than the
// resolved path keeps this working under bundlers and aliases, where the lookup can
// legitimately fail: an unknown answer counts as patched, since refusing to run is
// worse than missing the warning.
const detectCacheSupport = (load = loadCacheableRequest) => {
  try {
    return typeof load()?.prototype?.createCacheableRequest !== 'function'
  } catch {
    return true
  }
}

// got resolves cacheable-request once, so the answer cannot change afterwards.
const installedCacheSupport = detectCacheSupport()

const assertCacheSupport = load => {
  const supported = load === undefined ? installedCacheSupport : detectCacheSupport(load)
  if (!supported) throw new TypeError(CACHE_ERROR)
}

const honoredRange = res => res.statusCode === 206 && Number(res.headers['content-length']) <= 1

const willRetry = res => res.request.options.retry.statusCodes.includes(res.statusCode)

// `Range: bytes=0-0` asks for one byte, but a server is free to ignore it and
// send the whole entity, which `responseType: 'buffer'` would then buffer in
// full. Cancelling drops the rest of it: the status and headers already answer
// whether the URL is reachable. Not when caching, because cacheable-request
// stores the entry on `end`, which a cancelled response never emits, and not
// before a retry, because a CancelError is not retryable.
const shouldAbortDownload = (res, cache) => !cache && !honoredRange(res) && !willRetry(res)

const reachableUrl = async (url, opts) => {
  const cache = opts?.cache
  if (cache) assertCacheSupport()
  const followRedirect = opts?.followRedirect ?? got.defaults.options.followRedirect
  const req = got(url, opts)

  const redirectStatusCodes = []
  const redirectUrls = []
  let response
  let aborted = false

  req.on('response', res => {
    response = res
    if (!shouldAbortDownload(res, cache)) return
    aborted = true
    // `phases.total` is filled on `end`, which a cancelled request never emits,
    // and the timer does not record the cancel either.
    res.timings.phases.total = Date.now() - res.timings.start
    req.cancel()
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { isFulfilled, value, reason: error } = await pReflect(req)

  const mergedResponse = mergeResponse(isFulfilled ? value : error.response, response)

  // A retried request carries the body of the attempt before it; the one that was
  // cancelled has none.
  if (aborted) mergedResponse.body = undefined

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
module.exports.assertCacheSupport = assertCacheSupport

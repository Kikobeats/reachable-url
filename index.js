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

// `headers` is a prototype getter on IncomingMessage, so spreading never carries it.
const toResponse = (response = {}) => ({
  statusMessage: 'Not Found',
  statusCode: 404,
  ...response,
  headers: { ...response.headers }
})

const CACHE_ERROR = `The \`cache\` option needs @kikobeats/cacheable-request.

got resolved the unpatched cacheable-request@7, which never settles when the
origin keeps the connection alive, and no timeout recovers from it. Add the
override to your pnpm-workspace.yaml:

  overrides:
    got>cacheable-request: npm:@kikobeats/cacheable-request`

let cacheableRequestManifest
const loadCacheableRequestManifest = () =>
  (cacheableRequestManifest ??= require(require.resolve('cacheable-request/package.json', {
    paths: [require.resolve('got')]
  })))

// The override is an alias, which keeps the real package name, so the manifest says
// which one got resolved. Only a positive match rejects: the lookup can legitimately
// fail under a bundler, and refusing to run then is worse than missing the warning.
const assertCacheSupport = (load = loadCacheableRequestManifest) => {
  let name
  try {
    name = load().name
  } catch {
    return
  }
  if (name === 'cacheable-request') throw new TypeError(CACHE_ERROR)
}

const honoredRange = res => res.statusCode === 206 && Number(res.headers['content-length']) <= 1

const willRetry = res => {
  const { retry, method } = res.request.options
  return (
    res.retryCount < retry.limit &&
    retry.methods.includes(method) &&
    retry.statusCodes.includes(res.statusCode)
  )
}

// A server is free to ignore `Range` and send the whole entity, which
// `responseType: 'buffer'` would then buffer in full. Cancelling drops the rest
// of it: the status and headers already answer whether the URL is reachable. Not
// when caching, because cacheable-request stores the entry on `end`, which a
// cancelled response never emits, and not before a retry, because a CancelError
// is not retryable.
const shouldAbortDownload = (res, cache) => !cache && !honoredRange(res) && !willRetry(res)

const reachableUrl = async (url, opts) => {
  const cache = opts?.cache
  if (cache) assertCacheSupport()
  const followRedirect = opts?.followRedirect ?? got.defaults.options.followRedirect
  const req = got(url, opts)

  const redirectStatusCodes = []
  const redirectUrls = []
  let response

  req.on('response', res => {
    response = res
    if (!shouldAbortDownload(res, cache)) return
    // `phases.total` is filled on `end`, which a cancelled request never emits,
    // and the timer does not record the cancel either.
    res.timings.phases.total = Date.now() - res.timings.start
    req.cancel()
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { reason: error } = await pReflect(req)

  // Once a response arrived it is the whole truth: a retried or cancelled request
  // settles with the attempt before it, whose body is not this response's. Only a
  // failure with no response at all falls back, and MaxRedirects carries one.
  const mergedResponse = toResponse(response ?? error?.response)

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

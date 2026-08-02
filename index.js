'use strict'

const { URL } = require('url')

const RANGE_LENGTH = 1

const got = require('got').extend({
  decompress: false,
  responseType: 'buffer',
  retry: 1,
  headers: {
    Range: `bytes=0-${RANGE_LENGTH - 1}`
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
const toResponse = response => ({
  statusMessage: 'Not Found',
  statusCode: 404,
  ...response,
  headers: { ...response?.headers }
})

const CACHE_ERROR = `The \`cache\` option needs @kikobeats/cacheable-request.

got resolved the unpatched cacheable-request@7, which never settles when the
origin keeps the connection alive, and no timeout recovers from it. Add the
override to your pnpm-workspace.yaml:

  overrides:
    got>cacheable-request: npm:@kikobeats/cacheable-request`

const loadCacheableRequestManifest = () =>
  require(require.resolve('cacheable-request/package.json', { paths: [require.resolve('got')] }))

// The override is an alias, which keeps the real package name, so the manifest says
// which one got resolved. Only a positive match rejects: the lookup can legitimately
// fail under a bundler, and refusing to run then is worse than missing the warning.
const assertCacheSupport = (load = loadCacheableRequestManifest) => {
  let name
  try {
    name = load().name
  } catch {}
  if (name === 'cacheable-request') throw new TypeError(CACHE_ERROR)
}

const honoredRange = res =>
  res.statusCode === 206 && Number(res.headers['content-length']) <= RANGE_LENGTH

const willRetry = res => {
  const { retry, method } = res.request.options
  return (
    res.retryCount < retry.limit &&
    retry.methods.includes(method) &&
    retry.statusCodes.includes(res.statusCode) &&
    // got declines a 413 outright unless it carries a `retry-after`.
    (res.statusCode !== 413 || res.headers['retry-after'] !== undefined)
  )
}

// `responseType: 'buffer'` would read the whole entity a server sent despite
// `Range`; the status and headers already answer reachability. A cache entry is
// written on `end`, a retry needs a retryable error and `maxBody: Infinity` was
// asked for the entity, so all three keep the body.
const shouldAbortDownload = (res, maxBody) =>
  maxBody !== Infinity && !res.request.options.cache && !honoredRange(res) && !willRetry(res)

// Asking for a range while wanting more of the body than it holds is
// contradictory: a server honoring it would answer with that one byte.
const withoutRange = opts => ({ ...opts, headers: { ...opts.headers, Range: undefined } })

const cancelDownload = (req, res) => {
  // `phases.total` is filled on `end`, which a cancelled request never emits,
  // and the timer does not record the cancel either.
  res.timings.phases.total = Date.now() - res.timings.start
  req.cancel()
}

const reachableUrl = async (url, { maxBody = 0, ...opts } = {}) => {
  if (opts.cache) assertCacheSupport()
  const followRedirect = opts.followRedirect ?? got.defaults.options.followRedirect
  const req = got(url, maxBody > RANGE_LENGTH ? withoutRange(opts) : opts)

  const redirectStatusCodes = []
  const redirectUrls = []
  let response

  req.on('response', res => {
    response = res
    if (!shouldAbortDownload(res, maxBody)) return
    if (maxBody === 0) return cancelDownload(req, res)
    // An entity that already fits is read to the end, so got fills `body` itself.
    if (Number(res.headers['content-length']) <= maxBody) return

    const chunks = []
    let read = 0
    // The cancel is not immediate, so chunks already in flight keep arriving.
    const onData = chunk => {
      chunks.push(chunk)
      if ((read += chunk.length) < maxBody) return
      res.off('data', onData)
      res.body = Buffer.concat(chunks, maxBody)
      cancelDownload(req, res)
    }
    res.on('data', onData)
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  let errorResponse
  try {
    await req
  } catch (error) {
    errorResponse = error.response
  }

  // A retried or cancelled request settles with the attempt before it, whose body
  // is not this response's, so a response we saw outranks the error's. The error
  // still carries one when nothing else did, as MaxRedirects does.
  const resolvedResponse = toResponse(response ?? errorResponse)

  if (resolvedResponse.statusCode === 206) {
    const contentRange = resolvedResponse.headers['content-range']
    if (typeof contentRange === 'string') {
      let contentLength = contentRange.split('/')
      if (contentLength.length > 1) {
        contentLength = contentLength[contentLength.length - 1]
        resolvedResponse.statusCode = 200
        resolvedResponse.statusMessage = 'OK'
        resolvedResponse.headers['content-length'] = contentLength
        resolvedResponse.headers['content-range'] = undefined
      }
    }
  }

  return {
    url,
    ...resolvedResponse,
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

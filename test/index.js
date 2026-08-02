'use strict'

const { URL } = require('url')
const test = require('ava').default

const {
  LARGE_PAYLOAD,
  createTestServer,
  createEchoServer,
  createStatusServer,
  createRangeServer
} = require('./_helpers')

const reachableUrl = require('..')

const { isReachable } = reachableUrl

test('resolve GET request', async t => {
  const url = `${await createEchoServer(t)}/get`
  const res = await reachableUrl(url)
  t.deepEqual(res.redirectUrls, [])
  t.deepEqual(res.redirectStatusCodes, [])
  t.is(res.url, url)
  t.is(200, res.statusCode)
  t.true(isReachable(res))
})

// The range request exists so a GET resolves at the headers, the way a HEAD does.
// A server that announces a body and never sends it would otherwise hold the call
// open until the timeout, once per attempt.
test('resolve as fast a HEAD', async t => {
  let hits = 0
  const timeout = 1000
  const url = await createTestServer(t, (req, res) => {
    hits++
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': LARGE_PAYLOAD.length
    })
    res.write(LARGE_PAYLOAD.subarray(0, 1))
  })

  const res = await reachableUrl(url, { timeout })

  t.is(res.statusCode, 200)
  t.true(isReachable(res))
  t.is(hits, 1)
  t.is(res.body, undefined)
  t.true(res.timings.phases.total < timeout)
})

test('resolve redirect', async t => {
  const url = 'https://github.com/kikobeats/splashy'
  const res = await reachableUrl(url)
  t.deepEqual(res.redirectUrls, ['https://github.com/kikobeats/splashy'])
  t.deepEqual(res.redirectStatusCodes, [301])
  t.is('https://github.com/microlinkhq/splashy', res.url)
  t.is(200, res.statusCode)
  t.true(isReachable(res))
})

test('resolve multiple redirects', async t => {
  const url =
    'https://test-redirect-drab.vercel.app/?url=https%3A%2F%2Ftest-redirect-drab.vercel.app%3Furl%3Dhttps%253A%252F%252Ftest-redirect-drab.vercel.app%252F%253Furl%253Dhttps%253A%252F%252Fexample.com'
  const res = await reachableUrl(url)

  t.deepEqual(res.redirectUrls, [
    'https://test-redirect-drab.vercel.app/?url=https%3A%2F%2Ftest-redirect-drab.vercel.app%3Furl%3Dhttps%253A%252F%252Ftest-redirect-drab.vercel.app%252F%253Furl%253Dhttps%253A%252F%252Fexample.com',
    'https://test-redirect-drab.vercel.app/?url=https%3A%2F%2Ftest-redirect-drab.vercel.app%2F%3Furl%3Dhttps%3A%2F%2Fexample.com',
    'https://test-redirect-drab.vercel.app/?url=https://example.com'
  ])
  t.deepEqual(res.redirectStatusCodes, [302, 302, 302])
  t.is('https://example.com/', res.url)
  t.true(isReachable(res))
})

test('passing options', async t => {
  const url = 'https://test-redirect-drab.vercel.app?url=http%3A%2F%2Fexample.com%2F'
  const res = await reachableUrl(url, { followRedirect: false })
  t.is(302, res.statusCode)
  t.true(isReachable(res))
})

const createRedirectServer = (t, location = () => 'https://example.com') =>
  createTestServer(t, (req, res) => {
    res.writeHead(302, { location: location(req) })
    res.end()
  })

test('a redirect refused before connecting is not reachable', async t => {
  const url = await createRedirectServer(t)

  const res = await reachableUrl(url, {
    hooks: {
      beforeRedirect: [
        () => {
          throw new Error('Refusing to request a reserved address')
        }
      ]
    }
  })

  t.is(res.statusCode, 302)
  t.true(res.followRedirect)
  t.false(isReachable(res))
})

test('running out of redirects is not reachable', async t => {
  const url = await createRedirectServer(t, req => (req.url === '/' ? '/next' : '/'))

  const res = await reachableUrl(url, { maxRedirects: 1 })

  t.is(res.statusCode, 302)
  t.false(isReachable(res))
})

test('a redirect is the destination when redirects are not followed', async t => {
  const url = await createRedirectServer(t)

  const res = await reachableUrl(url, { followRedirect: false })

  t.is(res.statusCode, 302)
  t.false(res.followRedirect)
  t.true(isReachable(res))
})

test('isReachable treats a bare redirect status as unfinished', t => {
  t.true(isReachable({ statusCode: 200 }))
  t.false(isReachable({ statusCode: 404 }))
  t.false(isReachable({ statusCode: 302 }))
  t.true(isReachable({ statusCode: 302, followRedirect: false }))
})

test('resolve non encoding urls', async t => {
  const origin = await createEchoServer(t)

  const urlOne = `${origin}/anything/pr-experterna:-s-forsoker-ta-kommando-over-"svenskhet"-i-valfilm-fZlCYGEtZA`
  const resOne = await reachableUrl(urlOne)
  t.is(resOne.url, new URL(resOne.url).href)
  t.is(
    resOne.url,
    `${origin}/anything/pr-experterna:-s-forsoker-ta-kommando-over-%22svenskhet%22-i-valfilm-fZlCYGEtZA`
  )
  t.is(200, resOne.statusCode)
  t.true(isReachable(resOne))

  const urlTwo = `${origin}/anything/@Acegikmo/the-ever-so-lovely-bézier-curve-eb27514da3bf`
  const resTwo = await reachableUrl(urlTwo)
  t.is(resTwo.url, new URL(resTwo.url).href)
  t.is(resTwo.url, `${origin}/anything/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf`)
  t.is(200, resTwo.statusCode)
  t.true(isReachable(resTwo))
})

test('resolve already encoded urls', async t => {
  const origin = await createEchoServer(t)

  const url = `${origin}/anything/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf`
  const res = await reachableUrl(url)
  t.is(res.url, new URL(res.url).href)
  t.is(res.url, url)
  t.is(200, res.statusCode)
  t.true(isReachable(res))
})

test('keep original query search', async t => {
  const origin = await createEchoServer(t)

  const url = `${origin}/anything?screenshot&embed=screenshot.url&viewport.deviceScaleFactor=1&force`
  const res = await reachableUrl(url)
  t.is(res.url, url)

  t.is(200, res.statusCode)
  t.is(res.statusMessage, 'OK')
  t.true(Object.keys(res.headers).length > 0)
  t.truthy(res.headers['content-length'])
  t.falsy(res.headers['content-range'])
})

test("don't download the whole body", async t => {
  const body = 'x'.repeat(1024)
  const url = await createRangeServer(t, { body })

  const res = await reachableUrl(url)

  t.is(200, res.statusCode)
  t.is(res.statusMessage, 'OK')
  t.is(res.headers['content-length'], String(body.length))
  t.falsy(res.headers['content-range'])
  t.is(res.body.length, 1)
})

test('download jsut the first character from body', async t => {
  const url = await createRangeServer(t, { body: 'Hello, world' })

  const res = await reachableUrl(url)
  t.true(isReachable(res))
  t.is(res.body.toString(), 'H')
})

// The server never reads `Range`, so it always answers with the whole entity.
const sendPayload = (res, statusCode = 200) => {
  res.writeHead(statusCode, {
    'content-type': 'application/octet-stream',
    'content-length': LARGE_PAYLOAD.length
  })
  res.end(LARGE_PAYLOAD)
}

test('abort the download when the server ignores Range', async t => {
  let hits = 0
  const url = await createTestServer(t, (req, res) => {
    hits++
    sendPayload(res)
  })

  const res = await reachableUrl(url)

  t.is(res.statusCode, 200)
  t.true(isReachable(res))
  t.is(hits, 1)
  t.is(res.headers['content-length'], String(LARGE_PAYLOAD.length))
  t.is(res.body, undefined)
})

test('abort the download after a retry strips Range', async t => {
  let hits = 0
  const url = await createTestServer(t, (req, res) => {
    if (++hits === 1) return res.writeHead(500, { 'content-type': 'text/plain' }).end('error')
    sendPayload(res)
  })

  const res = await reachableUrl(url)

  t.is(res.statusCode, 200)
  t.true(isReachable(res))
  t.is(hits, 2)
  t.is(res.body, undefined)
})

// got stops retrying once the limit is reached, so the last attempt is abortable
// even though its status is in `retry.statusCodes`.
test('abort the download on a 5xx got will not retry', async t => {
  let hits = 0
  const url = await createTestServer(t, (req, res) => {
    hits++
    sendPayload(res, 500)
  })

  const res = await reachableUrl(url)

  t.is(res.statusCode, 500)
  t.false(isReachable(res))
  t.is(hits, 2)
  t.is(res.body, undefined)
})

test('abort the download on a 413 got will not retry', async t => {
  let hits = 0
  const url = await createTestServer(t, (req, res) => {
    hits++
    sendPayload(res, 413)
  })

  const res = await reachableUrl(url)

  t.is(res.statusCode, 413)
  t.is(hits, 1)
  t.is(res.body, undefined)
})

test('maxBody keeps the first bytes of an ignored Range', async t => {
  const url = await createTestServer(t, (req, res) => sendPayload(res))

  const res = await reachableUrl(url, { maxBody: 64 })

  t.is(res.statusCode, 200)
  t.deepEqual(res.body, LARGE_PAYLOAD.subarray(0, 64))
  // The whole point: the bytes arrive without the entity behind them.
  t.is(res.headers['content-length'], String(LARGE_PAYLOAD.length))
})

test('maxBody spans several chunks', async t => {
  const url = await createTestServer(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'content-length': 6 })
    res.write('ab')
    setTimeout(() => res.write('cd'), 20)
    setTimeout(() => res.end('ef'), 40)
  })

  const res = await reachableUrl(url, { maxBody: 4 })

  t.is(res.body.toString(), 'abcd')
})

test('maxBody leaves an entity that already fits', async t => {
  const url = await createTestServer(t, (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'content-length': 2 })
    res.end('ab')
  })

  const res = await reachableUrl(url, { maxBody: 64 })

  t.is(res.body.toString(), 'ab')
})

// Asking for one byte while wanting more would have a compliant server answer
// 206 with that byte, so the range has to go.
test('maxBody above the range keeps the whole body and drops the Range header', async t => {
  let range = 'unset'
  const url = await createTestServer(t, (req, res) => {
    range = req.headers.range
    sendPayload(res)
  })

  const res = await reachableUrl(url, { maxBody: Infinity })
  t.is(range, undefined)
  t.is(res.statusCode, 200)
  t.deepEqual(res.body, LARGE_PAYLOAD)

  await reachableUrl(url)
  t.is(range, 'bytes=0-0')
})

test('reject an unpatched cacheable-request', t => {
  const error = t.throws(
    () => reachableUrl.assertCacheSupport(() => ({ name: 'cacheable-request' })),
    { instanceOf: TypeError }
  )
  t.regex(error.message, /@kikobeats\/cacheable-request/)
})

test('the installed cacheable-request is patched', t => {
  t.notThrows(() => reachableUrl.assertCacheSupport())
})

test('an unresolvable cacheable-request is not rejected', t => {
  t.notThrows(() =>
    reachableUrl.assertCacheSupport(() => {
      throw new Error('Cannot find module')
    })
  )
})

test('handle DNS errors', async t => {
  const url =
    'http://android-app/com.twitter.android/twitter/user?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eandroidseo%7Ctwgr%5Eprofile&screen_name=Kikobeats'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(res.statusCode, 404)
  t.is(res.statusMessage, 'Not Found')
  t.is(Object.keys(res.headers).length, 0)
  t.false(isReachable(res))
})

test('keep original request url', async t => {
  const url = 'http://cdn.jsdelivr.net/npm/@microlink/mql@0.6.11/src/browser.js'
  const res = await reachableUrl(url)
  t.is(res.requestUrl, 'http://cdn.jsdelivr.net/npm/@microlink/mql@0.6.11/src/browser.js')
})

test('resolve url redirections', async t => {
  const url =
    'https://test-redirection.vercel.app/?url=https%3A%2F%2Fmicrolink.io%3Fref%3Dproduchunt'
  const res = await reachableUrl(url)
  t.is(res.url, 'https://microlink.io/?ref=produchunt')
})

test('resolve CDN url', async t => {
  const url = '//yastatic.net/iconostasis/_/wT9gfGZZ80sP0VsoR6dgDyXJf2Y.png'
  const res = await reachableUrl(url)
  t.is(res.url, 'https://yastatic.net/iconostasis/_/wT9gfGZZ80sP0VsoR6dgDyXJf2Y.png')
})

test('fast unreachable request resolution', async t => {
  t.timeout(1000)
  const url = `${await createStatusServer(t, 404)}/`
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.false(isReachable(res))
})

test('header `content-length` is present', async t => {
  const url = 'https://cdn.microlink.io/file-examples/sample.csv'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.true(isReachable(res))
  t.truthy(res.headers['content-length'])
  t.falsy(res.headers['content-range'])
})

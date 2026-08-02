'use strict'

const { URL } = require('url')
const test = require('ava').default
const got = require('got')

const {
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

test('resolve as fast a HEAD', async t => {
  const url = 'https://edge-ping.vercel.app/'

  const headResponse = await got.head(url, { throwHttpErrors: false })
  const headTime = headResponse.timings.phases.total

  const getResponse = await reachableUrl(url)
  const getTime = getResponse.timings.phases.total

  t.true(getTime <= headTime * 2)
})

test('resolve prerender GET request', async t => {
  const url = 'https://www.instagram.com/teslamotors'
  const res = await reachableUrl(url)
  t.is(200, res.statusCode)
  t.true(isReachable(res))
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

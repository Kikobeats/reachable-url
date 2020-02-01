'use strict'

const mql = require('@microlink/mql')
const { URL } = require('url')
const test = require('ava')

const reachableUrl = require('..')

const { isReachable } = reachableUrl

test('resolve GET request', async t => {
  const url = 'https://httpbin.org/get'
  const res = await reachableUrl(url)
  t.deepEqual(res.redirectUrls, [])
  t.deepEqual(res.redirectStatusCodes, [])
  t.is(res.url, url)
  t.is(200, res.statusCode)
  t.true(isReachable(res))
})

test('resolve HEAD requests', async t => {
  const { data } = await mql('https://www.youtube.com/watch?v=hwMkbaS_M_c', {
    audio: true,
    meta: false
  })
  const url = data.audio.url
  const res = await reachableUrl(url, { timeout: 3000 })
  t.is(200, res.statusCode)
  t.true(isReachable(res))
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
  const url = 'https://httpbin.org/redirect/3'
  const res = await reachableUrl(url)

  t.deepEqual(res.redirectUrls, [
    'https://httpbin.org/redirect/3',
    'https://httpbin.org/relative-redirect/2',
    'https://httpbin.org/relative-redirect/1'
  ])
  t.deepEqual(res.redirectStatusCodes, [302, 302, 302])
  t.is('https://httpbin.org/get', res.url)
  t.is(200, res.statusCode)
  t.true(isReachable(res))
})

test('passing options', async t => {
  const url = 'https://httpbin.org/redirect-to?url=http%3A%2F%2Fexample.com%2F'
  const res = await reachableUrl(url, { followRedirect: false })
  t.is(302, res.statusCode)
  t.true(isReachable(res))
})

test('resolve non encoding urls', async t => {
  const urlOne =
    'https://httpbin.org/anything/pr-experterna:-s-forsoker-ta-kommando-over-"svenskhet"-i-valfilm-fZlCYGEtZA'
  const resOne = await reachableUrl(urlOne)
  t.is(resOne.url, new URL(resOne.url).href)
  t.is(
    resOne.url,
    'https://httpbin.org/anything/pr-experterna:-s-forsoker-ta-kommando-over-%22svenskhet%22-i-valfilm-fZlCYGEtZA'
  )
  t.is(200, resOne.statusCode)
  t.true(isReachable(resOne))

  const urlTwo =
    'https://httpbin.org/anything/@Acegikmo/the-ever-so-lovely-bézier-curve-eb27514da3bf'
  const resTwo = await reachableUrl(urlTwo)
  t.is(resTwo.url, new URL(resTwo.url).href)
  t.is(
    resTwo.url,
    'https://httpbin.org/anything/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  )
  t.is(200, resTwo.statusCode)
  t.true(isReachable(resTwo))
})

test('resolve already encoded urls', async t => {
  const urlThree =
    'https://httpbin.org/anything/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  const resThree = await reachableUrl(urlThree)
  t.is(resThree.url, new URL(resThree.url).href)
  t.is(
    resThree.url,
    'https://httpbin.org/anything/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  )
  t.is(200, resThree.statusCode)
  t.true(isReachable(resThree))
})

test('keep original query search', async t => {
  const url = 'https://www.b92.net/biz/vesti/srbija.php?yyyy=2018&mm=11&dd=05&nav_id=1465369'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(200, res.statusCode)
  t.is(res.statusMessage, 'OK')
  t.true(Object.keys(res.headers).length > 0)
  t.true(isReachable(res))
})

test('handle DNS errors', async t => {
  const url =
    'http://android-app/com.twitter.android/twitter/user?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eandroidseo%7Ctwgr%5Eprofile&screen_name=Kikobeats'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(res.statusCode, 404)
  t.is(res.statusMessage, 'NOT FOUND')
  t.is(Object.keys(res.headers).length, 0)
  t.false(isReachable(res))
})
;[
  // 100,
  101,
  // 102,
  // 103,
  200,
  201,
  202,
  203,
  204,
  205,
  206,
  300,
  // 301,
  // 302,
  // 303,
  304,
  305,
  306,
  // 307,
  308,
  400,
  401,
  402,
  403,
  404,
  405,
  406,
  407,
  408,
  409,
  410,
  411,
  412,
  413,
  414,
  415,
  416,
  417,
  418,
  421,
  422,
  423,
  425,
  426,
  428,
  429,
  431,
  451,
  500,
  501,
  502,
  503,
  504,
  505,
  506,
  507,
  511,
  520,
  522,
  524
].forEach(statusCode => {
  test(`HTTP ${statusCode} `, async t => {
    const url = `https://httpbin.org/status/${statusCode}`
    const res = await reachableUrl(url, { timeout: 3000 })
    t.is(res.url, url)
    t.is(res.statusCode, statusCode)
  })
})

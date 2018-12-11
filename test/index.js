'use strict'

const { URL } = require('url')
const test = require('ava')

const reachableUrl = require('..')

test('resolve HEAD request', async t => {
  const url = 'https://google.com'
  const res = await reachableUrl(url)

  t.is(200, res.statusCode)
  t.is('HEAD', res.req.method)
})

test('resolve GET request', async t => {
  const url = 'https://httpbin-org.herokuapp.com/get'
  const res = await reachableUrl(url)

  t.is(200, res.statusCode)
  t.is('GET', res.req.method)
})

test('resolve redirect', async t => {
  const url = 'https://github.com/kikobeats/splashy'
  const res = await reachableUrl(url)

  t.deepEqual(res.redirectUrls, ['https://github.com/kikobeats/splashy'])
  t.deepEqual(res.redirectStatusCodes, [301])
  t.is('https://github.com/microlinkhq/splashy', res.url)
  t.is(200, res.statusCode)
})

test('resolve multiple redirects', async t => {
  const url = 'https://httpbin-org.herokuapp.com/redirect/3'
  const res = await reachableUrl(url)

  t.deepEqual(res.redirectUrls, [
    'https://httpbin-org.herokuapp.com/redirect/3',
    'https://httpbin-org.herokuapp.com/relative-redirect/2',
    'https://httpbin-org.herokuapp.com/relative-redirect/1'
  ])
  t.deepEqual(res.redirectStatusCodes, [302, 302, 302])
  t.is('https://httpbin-org.herokuapp.com/get', res.url)
  t.is(200, res.statusCode)
})

test('passing options', async t => {
  const url =
    'https://httpbin-org.herokuapp.com/redirect-to?url=http%3A%2F%2Fexample.com%2F'
  const res = await reachableUrl(url, { followRedirect: false })
  t.is(302, res.statusCode)
})

test('resolve non encoding urls', async t => {
  const urlOne =
    'https://www.metro.se/artikel/pr-experterna-s-försöker-ta-kommando-över-svenskhet-i-valfilm'
  const resOne = await reachableUrl(urlOne)
  t.is(resOne.url, new URL(resOne.url).href)
  t.is(
    resOne.url,
    'https://www.metro.se/artikel/pr-experterna-s-f%C3%B6rs%C3%B6ker-ta-kommando-%C3%B6ver-svenskhet-i-valfilm'
  )
  t.is(200, resOne.statusCode)

  const urlTwo =
    'https://medium.com/@Acegikmo/the-ever-so-lovely-bézier-curve-eb27514da3bf'
  const resTwo = await reachableUrl(urlTwo)
  t.is(resTwo.url, new URL(resTwo.url).href)
  t.is(
    resTwo.url,
    'https://medium.com/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  )
  t.is(200, resTwo.statusCode)
})

test('resolve already encoded urls', async t => {
  const urlThree =
    'https://medium.com/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  const resThree = await reachableUrl(urlThree)
  t.is(resThree.url, new URL(resThree.url).href)
  t.is(
    resThree.url,
    'https://medium.com/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  )
  t.is(200, resThree.statusCode)
})

test('keep original query search', async t => {
  const url =
    'https://www.b92.net/biz/vesti/srbija.php?yyyy=2018&mm=11&dd=05&nav_id=1465369'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(200, res.statusCode)
})

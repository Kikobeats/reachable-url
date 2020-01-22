'use strict'

const { URL } = require('url')
const test = require('ava')

const reachableUrl = require('..')

const range = n => [...Array(n).keys()]

test('resolve HEAD/GET request', async t => {
  const url = 'https://httpbin.org/get'
  const promises = range(10).map(() => reachableUrl(url))
  const results = await Promise.all(promises)
  const statusCodes = results.map(result => result.statusCode)
  const methods = results.map(result => result.req.method)
  t.true(statusCodes.every(value => value === 200))
  t.true(methods.some(value => value === 'HEAD'))
  t.true(methods.some(value => value === 'GET'))
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
})

test('passing options', async t => {
  const url = 'https://httpbin.org/redirect-to?url=http%3A%2F%2Fexample.com%2F'
  const res = await reachableUrl(url, { followRedirect: false })
  t.is(302, res.statusCode)
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

  const urlTwo =
    'https://httpbin.org/anything/@Acegikmo/the-ever-so-lovely-bézier-curve-eb27514da3bf'
  const resTwo = await reachableUrl(urlTwo)
  t.is(resTwo.url, new URL(resTwo.url).href)
  t.is(
    resTwo.url,
    'https://httpbin.org/anything/@Acegikmo/the-ever-so-lovely-b%C3%A9zier-curve-eb27514da3bf'
  )
  t.is(200, resTwo.statusCode)
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
})

test('keep original query search', async t => {
  const url =
    'https://www.b92.net/biz/vesti/srbija.php?yyyy=2018&mm=11&dd=05&nav_id=1465369'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(200, res.statusCode)
  t.is(res.statusMessage, 'OK')
  t.true(Object.keys(res.headers).length > 0)
})

test('handle 404 urls', async t => {
  const url = 'https://demo-1yr5bmtqy.now.sh/'
  const res = await reachableUrl(url, { timeout: 500 })
  t.is(res.url, url)
  t.is(res.statusCode, 404)
  t.is(res.statusMessage, 'Not Found')
})

test('handle 201 urls', async t => {
  const url = 'https://httpbin.org/status/201'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(res.statusCode, 201)
  t.is(res.statusMessage, 'CREATED')
})

test('handle 500 urls', async t => {
  const url = 'https://httpbin.org/status/500'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(res.statusCode, 500)
  t.is(res.statusMessage, 'INTERNAL SERVER ERROR')
})

test('handle DNS errors', async t => {
  const url =
    'http://android-app/com.twitter.android/twitter/user?ref_src=twsrc%5Egoogle%7Ctwcamp%5Eandroidseo%7Ctwgr%5Eprofile&screen_name=Kikobeats'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(res.statusCode, 404)
  t.is(res.statusMessage, 'Not Found')
  t.is(Object.keys(res.headers).length, 0)
})

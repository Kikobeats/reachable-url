'use strict'

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
  const url =
    'https://r3---sn-h5q7kne6.googlevideo.com/videoplayback?expire=1580077455&ei=Lr0tXsbYOYT3xgLT3qyIAQ&ip=88.0.25.71&id=o-ALGvCUB-YHc3EFopGRyEo8yA5CXmWwMA_W7aAlXisgjT&itag=140&source=youtube&requiressl=yes&mm=31%2C26&mn=sn-h5q7kne6%2Csn-aigzrn7d&ms=au%2Conr&mv=m&mvi=2&pl=16&initcwndbps=1136250&vprv=1&mime=audio%2Fmp4&gir=yes&clen=2248120&dur=141.502&lmt=1507952811949144&mt=1580055764&fvip=3&keepalive=yes&fexp=23842630&c=WEB&sparams=expire%2Cei%2Cip%2Cid%2Citag%2Csource%2Crequiressl%2Cvprv%2Cmime%2Cgir%2Cclen%2Cdur%2Clmt&lsparams=mm%2Cmn%2Cms%2Cmv%2Cmvi%2Cpl%2Cinitcwndbps&lsig=AHylml4wRAIgW5DeEEU8ubxNJ1uWksvGwsu8NlAImp6iDS2XDIdtKfoCIE354W9zSElzKPRZHWLdRYqTljSXY9E-eGO_lJH4vf2D&sig=ALgxI2wwRQIhAOXja7uKOOyS-vabn08tHzOMJ-bpwl_5L0LP8n-K-GAFAiBwQMN-M8XNwBBWf8X_r7FOQgweolR_R-f73MYaZ6wXdg==&ratebypass=yes'
  const res = await reachableUrl(url, { timeout: 5000 })
  t.deepEqual(res.redirectUrls, [])
  t.deepEqual(res.redirectStatusCodes, [])
  // t.is(res.url, url)g s
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

test('handle 404 urls', async t => {
  const url = 'https://demo-1yr5bmtqy.now.sh/'
  const res = await reachableUrl(url, { timeout: 500 })
  t.is(res.url, url)
  t.is(res.statusCode, 404)
  t.is(res.statusMessage, 'Not Found')
  t.false(isReachable(res))
})

test('handle 201 urls', async t => {
  const url = 'https://httpbin.org/status/201'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(res.statusCode, 201)
  t.is(res.statusMessage, 'CREATED')
  t.true(isReachable(res))
})

test('handle 500 urls', async t => {
  const url = 'https://httpbin.org/status/500'
  const res = await reachableUrl(url)
  t.is(res.url, url)
  t.is(res.statusCode, 500)
  t.is(res.statusMessage, 'INTERNAL SERVER ERROR')
  t.false(isReachable(res))
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

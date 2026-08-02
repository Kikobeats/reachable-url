'use strict'

const test = require('ava').default

const reachableUrl = require('..')

test("don't cache response with no cache-control", async t => {
  const url = 'https://test-http.vercel.app/'
  const cache = new Map()

  const responseOne = await reachableUrl(url, { cache, timeout: 3000 })

  t.is(responseOne.isFromCache, false)
  t.is(cache.size, 1)

  const responseTwo = await reachableUrl(url, { cache, timeout: 3000 })

  t.is(responseTwo.isFromCache, false)
  t.is(cache.size, 1)
})

test('4xx', async t => {
  const url = 'https://test-http.vercel.app/?statusCode=400&maxAge=300'
  const cache = new Map()

  const responseOne = await reachableUrl(url, { cache })

  t.is(responseOne.isFromCache, false)
  t.is(cache.size, 1)

  const responseTwo = await reachableUrl(url, { cache })

  t.is(responseTwo.isFromCache, true)
  t.is(cache.size, 1)
})

test('5xx', async t => {
  const url = 'https://test-http.vercel.app/?statusCode=500&maxAge=300'
  const cache = new Map()

  await reachableUrl(url, { cache, timeout: 3000 })
  const response = await reachableUrl(url, { cache, timeout: 3000 })

  t.is(response.isFromCache, true)
  t.is(cache.size, 1)
})

test('3xx', async t => {
  const url = 'https://test-http.vercel.app/?statusCode=300&maxAge=300'
  const cache = new Map()

  const responseOne = await reachableUrl(url, { cache })

  t.is(responseOne.isFromCache, false)
  t.is(cache.size, 1)

  const responseTwo = await reachableUrl(url, { cache })

  t.is(responseTwo.isFromCache, true)
  t.is(cache.size, 1)
})

test('2xx', async t => {
  const url = 'https://test-http.vercel.app/?maxAge=300'
  const cache = new Map()

  const responseOne = await reachableUrl(url, { cache, timeout: 3000 })

  t.is(responseOne.isFromCache, false)
  t.is(cache.size, 1)

  const responseTwo = await reachableUrl(url, { cache, timeout: 3000 })

  t.is(responseTwo.isFromCache, true)
  t.is(cache.size, 1)
})

// Stays on a remote asset: `{ cache }` against a keep-alive HTTP/1.1 origin
// never resolves on Linux, so a local server hangs this test on CI.
test('static asset', async t => {
  const url = 'https://cdn.microlink.io/file-examples/sample.csv'
  const cache = new Map()

  const responseOne = await reachableUrl(url, { cache })

  t.is(responseOne.isFromCache, false)
  t.is(cache.size, 1)

  const responseTwo = await reachableUrl(url, { cache })

  t.is(responseTwo.isFromCache, true)
  t.is(cache.size, 1)
})

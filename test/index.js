'use strict'

const test = require('ava')
const reachableUrl = require('..')

test('resolve HEAD request', async t => {
  const url = 'https://google.com'
  const res = await reachableUrl(url)

  t.is(200, res.statusCode)
  t.is('HEAD', res.req.method)
})

test('resolve GET request', async t => {
  const url = 'https://httpbin.org/get'
  const res = await reachableUrl(url)

  t.is(200, res.statusCode)
  t.is('GET', res.req.method)
})

test('passing options', async t => {
  const url = 'https://httpbin.org/redirect-to?url=http%3A%2F%2Fexample.com%2F'
  const res = await reachableUrl(url, { followRedirect: false })
  t.is(302, res.statusCode)
})

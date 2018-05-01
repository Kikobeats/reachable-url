'use strict'

const test = require('ava')
const reachableUrl = require('..')

test('resolve HEAD request', async t => {
  const url = 'https://kikobeats.com'
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

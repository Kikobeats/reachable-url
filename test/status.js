'use strict'

const test = require('ava')

const reachableUrl = require('..')

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
  test(`HTTP ${statusCode}`, async t => {
    const url = `https://httpbin.org/status/${statusCode}`
    const res = await reachableUrl(url, { timeout: 15000 })
    t.is(res.url, url)
    t.is(res.statusCode, statusCode)
  })
})

test('HTTP 999', async t => {
  const url = 'https://www.linkedin.com/in/kikobeats'
  const res = await reachableUrl(url, { timeout: 15000 })
  t.is(res.url, url)
  t.is(res.statusCode, 999)
})

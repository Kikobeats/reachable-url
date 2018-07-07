'use strict'

const pAny = require('p-any')
const got = require('got')

const createRequest = method => async (url, opts) => {
  const req = got[method](url, opts)
  const redirectUrls = []

  req.on('redirect', res => redirectUrls.push([res.statusCode, res.url]))

  return { ...(await req), redirectUrls }
}

const fromHEAD = createRequest('head')
const fromGET = createRequest('get')

module.exports = (url, opts = {}) =>
  pAny([fromHEAD(url, opts), fromGET(url, opts)])

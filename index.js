'use strict'

const pAny = require('p-any')
const { URL } = require('url')
const got = require('got')

const createRequest = method => async (url, opts) => {
  const req = got[method](url, { encoding: null, retry: 0, ...opts })
  const redirectStatusCodes = []
  const redirectUrls = []

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  return { ...(await req), redirectUrls, redirectStatusCodes }
}

const fromHEAD = createRequest('head')
const fromGET = createRequest('get')

module.exports = (url, opts = {}) => {
  const { href: encodedUrl } = new URL(url)
  return pAny([fromHEAD(encodedUrl, opts), fromGET(encodedUrl, opts)])
}

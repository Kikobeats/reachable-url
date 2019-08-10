'use strict'

const isCdnUrl = require('is-cdn-url')
const { URL } = require('url')
const pAny = require('p-any')
const got = require('got')

const createRequest = method => async (url, opts) => {
  const req = got[method](url, { encoding: null, ...opts })
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
  if (isCdnUrl(url)) url = `https:${url}`
  const { href: encodedUrl } = new URL(url)
  return pAny([fromHEAD(encodedUrl, opts), fromGET(encodedUrl, opts)])
}

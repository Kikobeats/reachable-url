'use strict'

const pReflect = require('p-reflect')
const pTimeout = require('p-timeout')
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

  const { isFulfilled, value: response = {}, reason: error } = await pReflect(
    pTimeout(req, opts.timeout || Infinity)
  )

  return {
    isFulfilled,
    value: { ...response, redirectUrls, redirectStatusCodes },
    error
  }
}

const wrapRequest = fetch => async (url, opts = {}) => {
  const { href: encodedUrl } = new URL(url)
  const { isFulfilled, value, error } = await fetch(encodedUrl, opts)

  return isFulfilled
    ? value
    : {
        redirectStatusCodes: [],
        redirectUrls: [],
        statusCode: error.statusCode || 404,
        headers: error.headers || {},
        statusMessage: error.statusMessage || 'Not Found',
        url: error.url || url
      }
}

const fromGET = wrapRequest(createRequest('get'))
const fromHEAD = wrapRequest(createRequest('head'))

const isReachable = ({ statusCode }) => statusCode >= 200 && statusCode < 400

module.exports = async (url, opts = {}) => {
  const { href: encodedUrl } = new URL(url)

  const get = await fromGET(encodedUrl, opts)
  if (isReachable(get)) return get

  const head = await fromHEAD(encodedUrl, opts)
  if (isReachable(head)) return head

  return head.statusCode < get.statusCode ? head : get
}

module.exports.isReachable = isReachable

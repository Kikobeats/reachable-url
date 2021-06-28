'use strict'

const pReflect = require('p-reflect')
const pTimeout = require('p-timeout')
const { URL } = require('url')
const got = require('got')

const createFetcher = method => async (url, opts = {}) => {
  const req = got(url, {
    responseType: 'buffer',
    method,
    ...opts
  })

  const redirectStatusCodes = []
  const redirectUrls = []
  let statusMessage = 'NOT FOUND'
  let statusCode = 404
  let headers = {}

  req.on('response', res => {
    res.destroy()
    headers = res.headers
    statusCode = res.statusCode
    statusMessage = res.statusMessage
  })

  req.on('redirect', res => {
    redirectUrls.push(res.url)
    redirectStatusCodes.push(res.statusCode)
  })

  const { isFulfilled, value: response = {}, reason: error } = await pReflect(
    pTimeout(req, opts.timeout || Infinity)
  )

  return {
    url,
    headers,
    statusCode,
    statusMessage,
    ...(isFulfilled ? response : error.response),
    redirectUrls,
    redirectStatusCodes
  }
}

const createRequest = fetch => (url, opts) => fetch(url, opts)

const fromGET = createRequest(createFetcher('get'))
const fromHEAD = createRequest(createFetcher('head'))

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

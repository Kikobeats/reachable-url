'use strict'

const pAny = require('p-any')
const got = require('got')

const createRequest = method => async (url, opts) => got[method](url, opts)

const fromHEAD = createRequest('head')
const fromGET = createRequest('get')

module.exports = (url, opts = {}) =>
  pAny([fromHEAD(url, opts), fromGET(url, opts)])

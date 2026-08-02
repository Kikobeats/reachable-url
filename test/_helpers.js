'use strict'

const { default: listen } = require('async-listen')
const { createServer } = require('http')
const { promisify } = require('util')

const createTestServer = async (t, handler) => {
  const server = createServer(handler)
  t.teardown(() => promisify(server.close.bind(server))())
  const { origin } = await listen(server, { port: 0, host: '127.0.0.1' })
  return origin
}

const createEchoServer = t =>
  createTestServer(t, (req, res) => {
    const body = JSON.stringify({ url: req.url })
    res.writeHead(200, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(body)
    })
    res.end(body)
  })

const createStatusServer = (t, statusCode) =>
  createTestServer(t, (req, res) => {
    res.writeHead(statusCode)
    res.end()
  })

const createAssetServer = (t, { body, cacheControl }) =>
  createTestServer(t, (req, res) => {
    const headers = { 'content-type': 'text/plain', 'content-length': Buffer.byteLength(body) }
    if (cacheControl) headers['cache-control'] = cacheControl
    res.writeHead(200, headers)
    res.end(body)
  })

const createRangeServer = (t, { body }) =>
  createTestServer(t, (req, res) => {
    const totalLength = Buffer.byteLength(body)
    const matches = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')

    if (matches === null) {
      res.writeHead(200, { 'content-type': 'text/plain', 'content-length': totalLength })
      return res.end(body)
    }

    const start = Number(matches[1])
    const end = matches[2] === '' ? totalLength - 1 : Number(matches[2])
    const chunk = body.slice(start, end + 1)

    res.writeHead(206, {
      'content-type': 'text/plain',
      'accept-ranges': 'bytes',
      'content-range': `bytes ${start}-${end}/${totalLength}`,
      'content-length': Buffer.byteLength(chunk)
    })
    res.end(chunk)
  })

module.exports = {
  createTestServer,
  createEchoServer,
  createStatusServer,
  createAssetServer,
  createRangeServer
}

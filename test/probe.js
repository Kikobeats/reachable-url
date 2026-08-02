'use strict'

const { createServer } = require('net')
const { promisify } = require('util')
const test = require('ava').default

const reachableUrl = require('..')

const BODY = 'x'.repeat(64)

// Raw HTTP/1.1 so `Connection` can be set, or omitted entirely, which the
// http server never allows.
const rawServer = (t, { status, connection, partial }) =>
  new Promise(resolve => {
    const server = createServer(socket => {
      socket.once('data', () => {
        const body = partial ? BODY.slice(0, 1) : BODY
        const headers = [
          'content-type: text/plain',
          `content-length: ${Buffer.byteLength(body)}`,
          'cache-control: public, max-age=300'
        ]
        if (partial) headers.push(`content-range: bytes 0-0/${Buffer.byteLength(BODY)}`)
        if (connection) headers.push(`connection: ${connection}`)
        socket.write(`HTTP/1.1 ${status}\r\n${headers.join('\r\n')}\r\n\r\n${body}`)
        if (connection === 'close') socket.end()
      })
    })
    t.teardown(() => promisify(server.close.bind(server))())
    server.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`))
  })

const probe = (name, { status, connection, partial, cache = true }) =>
  test(`probe ${name}`, async t => {
    const url = await rawServer(t, { status, connection, partial })
    const result = await Promise.race([
      reachableUrl(url, cache ? { cache: new Map() } : {}).then(res => `OK ${res.statusCode}`),
      new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 4000))
    ])
    process.stderr.write(`PROBE ${name.padEnd(28)} -> ${result}\n`)
    t.pass()
  })

// The 2x2 the earlier matrix skipped: status and Connection varied independently.
probe('200-keepalive', { status: '200 OK', connection: 'keep-alive' })
probe('200-close', { status: '200 OK', connection: 'close' })
probe('206-keepalive', { status: '206 Partial Content', connection: 'keep-alive', partial: true })
probe('206-close', { status: '206 Partial Content', connection: 'close', partial: true })

// The vercel shape: no Connection header at all.
probe('200-noheader', { status: '200 OK' })
probe('206-noheader', { status: '206 Partial Content', partial: true })

// Control: same origins without the cache option.
probe('200-keepalive-nocache', { status: '200 OK', connection: 'keep-alive', cache: false })
probe('206-keepalive-nocache', {
  status: '206 Partial Content',
  connection: 'keep-alive',
  partial: true,
  cache: false
})

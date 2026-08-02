'use strict'

const { default: listen } = require('async-listen')
const { createServer } = require('http')
const test = require('ava').default

const reachableUrl = require('..')

const BODY = 'x'.repeat(1024)

const serve = async (t, handler) => {
  const server = createServer(handler)
  t.teardown(() => new Promise(resolve => server.close(resolve)))
  const { origin } = await listen(server, { port: 0, host: '127.0.0.1' })
  return origin
}

const probe = (name, { handler, opts }) =>
  test(`probe ${name}`, async t => {
    const url = await serve(t, handler)
    const result = await Promise.race([
      reachableUrl(url, opts).then(res => `${res.statusCode} bodyLen=${res.body.length}`),
      new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 4000))
    ])
    process.stderr.write(`PROBE ${name} -> ${result}\n`)
    t.pass()
  })

const plain = extra => (req, res) => {
  res.writeHead(200, {
    'content-type': 'text/plain',
    'content-length': Buffer.byteLength(BODY),
    ...extra
  })
  res.end(BODY)
}

const ranged = extra => (req, res) => {
  const total = Buffer.byteLength(BODY)
  const matches = /bytes=(\d+)-(\d*)/.exec(req.headers.range ?? '')
  if (matches === null) return plain(extra)(req, res)
  const start = Number(matches[1])
  const end = matches[2] === '' ? total - 1 : Number(matches[2])
  const chunk = BODY.slice(start, end + 1)
  res.writeHead(206, {
    'content-type': 'text/plain',
    'accept-ranges': 'bytes',
    'content-range': `bytes ${start}-${end}/${total}`,
    'content-length': Buffer.byteLength(chunk),
    ...extra
  })
  res.end(chunk)
}

const CACHEABLE = { 'cache-control': 'public, max-age=300' }

probe('1-nocache-plain', { handler: plain(CACHEABLE), opts: {} })
probe('2-cache-plain', { handler: plain(CACHEABLE), opts: { cache: new Map() } })
probe('3-cache-nocachecontrol', { handler: plain({}), opts: { cache: new Map() } })
probe('4-cache-ranged', { handler: ranged(CACHEABLE), opts: { cache: new Map() } })
probe('5-cache-close', {
  handler: plain({ ...CACHEABLE, connection: 'close' }),
  opts: { cache: new Map() }
})
probe('6-cache-timeout-opt', {
  handler: plain(CACHEABLE),
  opts: { cache: new Map(), timeout: 3000 }
})
probe('7-cache-smallbody', {
  handler: (req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain', 'content-length': 2, ...CACHEABLE })
    res.end('hi')
  },
  opts: { cache: new Map() }
})

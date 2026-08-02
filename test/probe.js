'use strict'

const { execFile } = require('child_process')
const { promisify } = require('util')
const test = require('ava').default

// Does the cache + keep-alive hang reproduce in a plain node process, or is it
// an artefact of the AVA worker? Runs the same scenario in a child process.
const SCRIPT = `
const { createServer } = require('net')
const reachableUrl = require(${JSON.stringify(require.resolve('..'))})

const server = createServer(socket => {
  socket.once('data', () => {
    const body = 'x'.repeat(64)
    socket.write(
      'HTTP/1.1 200 OK\\r\\n' +
      'content-type: text/plain\\r\\n' +
      'content-length: ' + body.length + '\\r\\n' +
      'cache-control: public, max-age=300\\r\\n' +
      'connection: keep-alive\\r\\n\\r\\n' + body
    )
  })
})

server.listen(0, '127.0.0.1', async () => {
  const url = 'http://127.0.0.1:' + server.address().port
  const result = await Promise.race([
    reachableUrl(url, { cache: new Map() }).then(res => 'OK ' + res.statusCode),
    new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), 5000))
  ])
  const resolved = require.resolve('cacheable-request', { paths: [require.resolve('got')] })
  console.log(process.platform + ' ' + process.version + ' -> ' + result)
  console.log('got resolves cacheable-request to: ' + resolved)
  process.exit(0)
})
`

test('cache + keep-alive outside the ava worker', async t => {
  const { stdout } = await promisify(execFile)(process.execPath, ['-e', SCRIPT], {
    timeout: 20000
  })
  stdout
    .trim()
    .split('\n')
    .forEach(line => process.stderr.write(`PROBE ${line}\n`))
  t.pass()
})

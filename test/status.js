'use strict'

const test = require('ava')
const http = require('http')
const path = require('path')
const fs = require('fs')

const reachableUrl = require('..')

const statusCodes = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../scripts/status-codes.json'), 'utf8')
)
  .filter(entry => entry.state === 'success')
  .map(entry => entry.status)

let server
let serverPort

test.before(async () => {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`)
        const statusCode = parseInt(url.searchParams.get('status'))

        if (isNaN(statusCode)) {
          res.statusCode = 400
          res.end('Missing or invalid status parameter')
          return
        }

        res.statusCode = statusCode
        res.setHeader('Content-Type', 'text/plain')
        res.end(`Test response with status ${statusCode}`)
      } catch (error) {
        res.statusCode = 500
        res.end('Internal server error')
      }
    })

    server.on('error', reject)

    server.listen(0, 'localhost', () => {
      serverPort = server.address().port
      resolve()
    })
  })
})

test.after.always(() => {
  if (server) server.close()
})

statusCodes.forEach(statusCode => {
  test(`HTTP ${statusCode}`, async t => {
    const url = `http://localhost:${serverPort}/?status=${statusCode}`
    const res = await reachableUrl(url, { timeout: 5000 })
    t.is(res.url, url)
    t.is(res.statusCode, statusCode)
  })
})

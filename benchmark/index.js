'use strict'

const { writeFileSync } = require('fs')
const { createServer } = require('http')
const { join } = require('path')
const { setFlagsFromString } = require('v8')
const { runInNewContext } = require('vm')

const reachableUrl = require('..')

const RUNS = 7
const RANGE_REQUESTS = 400
const REDIRECT_HOPS = 10
const REDIRECT_CHAINS = 40
const LARGE_BODY_BYTES = 16 * 1024 * 1024
const LARGE_BODY_REQUESTS = 100
const MAX_BODY_BYTES = 64 * 1024
const MAX_BODY_REQUESTS = 100
const RESOURCE_BYTES = 12345

const median = values => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

setFlagsFromString('--expose-gc')
const collectGarbage = runInNewContext('gc')

const now = () => process.hrtime.bigint()

const elapsed = started => Number(now() - started) / 1e6

const LARGE_BODY = Buffer.alloc(LARGE_BODY_BYTES, 97)

const serveRange = res => {
  res.writeHead(206, {
    'content-type': 'application/octet-stream',
    'accept-ranges': 'bytes',
    'content-range': `bytes 0-0/${RESOURCE_BYTES}`,
    'content-length': '1'
  })
  res.end('a')
}

const serveLargeBody = res => {
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': String(LARGE_BODY_BYTES)
  })
  res.end(LARGE_BODY)
}

const serveRedirect = (res, hops) => {
  res.writeHead(302, { location: hops > 1 ? `/redirect/${hops - 1}` : '/range' })
  res.end()
}

const handler = (req, res) => {
  res.on('error', () => {})
  const [, route, hops] = req.url.split('/')
  if (route === 'large') return serveLargeBody(res)
  if (route === 'redirect') return serveRedirect(res, Number(hops))
  return serveRange(res)
}

const listen = () =>
  new Promise(resolve => {
    const server = createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, origin: `http://127.0.0.1:${server.address().port}` })
    })
  })

const isWholeResource = response =>
  response.statusCode === 200 && response.headers['content-length'] === String(RESOURCE_BYTES)

const sequential = async (count, request) => {
  let matched = 0
  for (let index = 0; index < count; index++) {
    if (await request()) matched++
  }
  return matched
}

const rangeCase = {
  name: 'range probe',
  extra: `${RANGE_REQUESTS} sequential 206 range probes rewritten to 200`,
  timed: origin =>
    sequential(RANGE_REQUESTS, async () => isWholeResource(await reachableUrl(`${origin}/range`))),
  verify: matched => matched === RANGE_REQUESTS
}

const redirectCase = {
  name: `redirect chain x${REDIRECT_HOPS}`,
  extra: `${REDIRECT_CHAINS} sequential chains of ${REDIRECT_HOPS} redirects`,
  timed: origin =>
    sequential(REDIRECT_CHAINS, async () => {
      const response = await reachableUrl(`${origin}/redirect/${REDIRECT_HOPS}`)
      return isWholeResource(response) && response.redirectUrls.length === REDIRECT_HOPS
    }),
  verify: matched => matched === REDIRECT_CHAINS
}

const cancelCase = {
  name: 'cancel 16MB body',
  extra: `${LARGE_BODY_REQUESTS} sequential probes of a ${LARGE_BODY_BYTES} byte body that ignores Range`,
  timed: origin =>
    sequential(LARGE_BODY_REQUESTS, async () => {
      const response = await reachableUrl(`${origin}/large`)
      return response.statusCode === 200
    }),
  verify: matched => matched === LARGE_BODY_REQUESTS
}

const maxBodyCase = {
  name: 'maxBody 64KB of 16MB body',
  extra: `${MAX_BODY_REQUESTS} sequential reads of the first ${MAX_BODY_BYTES} bytes of a ${LARGE_BODY_BYTES} byte body`,
  timed: origin =>
    sequential(MAX_BODY_REQUESTS, async () => {
      const response = await reachableUrl(`${origin}/large`, { maxBody: MAX_BODY_BYTES })
      return response.statusCode === 200 && response.body.length === MAX_BODY_BYTES
    }),
  verify: matched => matched === MAX_BODY_REQUESTS
}

const CASES = [rangeCase, redirectCase, cancelCase, maxBodyCase]

const fmt = value => value.toFixed(1)

const report = slot => {
  const med = slot.walls.length ? median(slot.walls) : Number.NaN
  const min = slot.walls.length ? Math.min(...slot.walls) : Number.NaN
  const max = slot.walls.length ? Math.max(...slot.walls) : Number.NaN
  const extra = `${slot.entry.extra}, errors ${slot.errors}, runs ${RUNS}`
  console.log(`${slot.entry.name}  median ${fmt(med)}ms  range ${fmt(min)}-${fmt(max)}  ${extra}`)
  return {
    name: slot.entry.name,
    unit: 'ms',
    value: Number(med.toFixed(1)),
    range: `${fmt(min)}-${fmt(max)}`,
    extra
  }
}

const takeSample = async (slot, origin, run) => {
  try {
    collectGarbage()
    const started = now()
    const outcome = await slot.entry.timed(origin)
    const wall = elapsed(started)
    if (!slot.entry.verify(outcome)) {
      console.error(`${slot.entry.name} run ${run} produced unexpected output`)
      slot.errors++
      return
    }
    slot.walls.push(wall)
  } catch (error) {
    console.error(error)
    slot.errors++
  }
}

const main = async () => {
  const { server, origin } = await listen()
  try {
    const slots = []
    for (const entry of CASES) {
      await entry.timed(origin)
      slots.push({ entry, walls: [], errors: 0 })
    }
    for (let run = 0; run < RUNS; run++) {
      for (const slot of slots) await takeSample(slot, origin, run)
    }
    const results = slots.map(report)
    writeFileSync(
      join(__dirname, '..', 'benchmark-output.json'),
      JSON.stringify(results, null, 2) + '\n'
    )
    const errors = slots.reduce((total, slot) => total + slot.errors, 0)
    if (errors > 0 || results.some(result => !Number.isFinite(result.value))) {
      process.exitCode = 1
    }
  } finally {
    server.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})

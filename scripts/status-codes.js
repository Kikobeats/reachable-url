#!/usr/bin/env node
'use strict'

const http = require('http')
const { URL } = require('url')

// Configuration constants
const STATUS_CODE_RANGE_START = 100
const STATUS_CODE_RANGE_END = 1200
const SERVER_PORT = 3000
const SERVER_HOST = 'localhost'
const REQUEST_TIMEOUT = 5000 // 5 seconds timeout

/**
 * Creates a simple HTTP server that responds with the requested status code
 * @param {number} port - Port to listen on
 * @returns {Promise<http.Server>} - The created server instance
 */
function createTestServer (port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url, `http://${req.headers.host}`)
        const statusCode = parseInt(url.searchParams.get('status'))

        // Validate status code
        if (
          isNaN(statusCode) ||
          statusCode < STATUS_CODE_RANGE_START ||
          statusCode > STATUS_CODE_RANGE_END
        ) {
          res.statusCode = 400
          res.end('Invalid status code parameter')
          return
        }

        // Set the requested status code and end the response
        res.statusCode = statusCode
        res.setHeader('Content-Type', 'text/plain')
        res.end(`Status code ${statusCode} response`)
      } catch (error) {
        res.statusCode = 500
        res.end('Server error')
      }
    })

    server.on('error', reject)

    server.listen(port, SERVER_HOST, () => {
      console.log(`✅ Test server running on http://${SERVER_HOST}:${port}`)
      resolve(server)
    })
  })
}

/**
 * Makes an HTTP request to test a specific status code
 * @param {number} statusCode - The status code to test
 * @param {number} port - Server port
 * @returns {Promise<{statusCode: number, canHandle: boolean, error?: string}>}
 */
function testStatusCode (statusCode, port) {
  return new Promise(resolve => {
    const url = `http://${SERVER_HOST}:${port}/?status=${statusCode}`

    const req = http.get(url, res => {
      let responseData = ''

      res.on('data', chunk => {
        responseData += chunk
      })

      res.on('end', () => {
        // Consider it handled only if the received status code matches the requested one
        const canHandle = res.statusCode === statusCode
        resolve({
          statusCode,
          canHandle,
          receivedStatusCode: res.statusCode,
          responseData: responseData.slice(0, 100) // Limit response data for logging
        })
      })

      res.on('error', error => {
        resolve({
          statusCode,
          canHandle: false,
          error: error.message
        })
      })
    })

    req.on('error', error => {
      resolve({
        statusCode,
        canHandle: false,
        error: error.message
      })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({
        statusCode,
        canHandle: false,
        error: 'Request timeout'
      })
    })

    req.setTimeout(REQUEST_TIMEOUT)
  })
}

/**
 * Generates an array of status codes to test
 * @param {number} start - Starting status code
 * @param {number} end - Ending status code
 * @returns {number[]} - Array of status codes
 */
function generateStatusCodes (start, end) {
  const codes = []
  for (let i = start; i <= end; i++) {
    codes.push(i)
  }
  return codes
}

/**
 * Tests all status codes and returns results
 * @param {number[]} statusCodes - Array of status codes to test
 * @param {number} port - Server port
 * @returns {Promise<Object>} - Test results
 */
async function testAllStatusCodes (statusCodes, port) {
  const results = {
    handleable: [],
    unhandleable: [],
    errors: []
  }

  console.log(`🔍 Testing ${statusCodes.length} status codes...`)

  // Test status codes in batches to avoid overwhelming the server
  const batchSize = 50

  for (let i = 0; i < statusCodes.length; i += batchSize) {
    const batch = statusCodes.slice(i, i + batchSize)
    const batchPromises = batch.map(code => testStatusCode(code, port))

    const batchResults = await Promise.all(batchPromises)

    batchResults.forEach(result => {
      if (result.canHandle) {
        results.handleable.push(result.statusCode)
      } else {
        results.unhandleable.push(result.statusCode)
        if (result.error) {
          results.errors.push({
            statusCode: result.statusCode,
            error: result.error
          })
        }
      }
    })
  }
  return results
}

/**
 * Displays the test results in a formatted manner
 * @param {Object} results - Test results object
 */
function displayResults (results) {
  console.log('\n' + '='.repeat(60))
  console.log('🎯 HTTP STATUS CODE TESTING RESULTS')
  console.log('='.repeat(60))

  console.log(`\n✅ HANDLEABLE STATUS CODES (${results.handleable.length}):`)
  console.log('-'.repeat(40))

  // Group handleable codes by ranges for better readability
  const ranges = groupConsecutiveNumbers(results.handleable)
  ranges.forEach(range => {
    if (range.start === range.end) {
      console.log(`   ${range.start}`)
    } else {
      console.log(`   ${range.start}-${range.end}`)
    }
  })

  console.log(`\n❌ UNHANDLEABLE STATUS CODES (${results.unhandleable.length}):`)
  console.log('-'.repeat(40))

  if (results.unhandleable.length > 0) {
    const unhandleableRanges = groupConsecutiveNumbers(results.unhandleable)
    unhandleableRanges.forEach(range => {
      if (range.start === range.end) {
        console.log(`   ${range.start}`)
      } else {
        console.log(`   ${range.start}-${range.end}`)
      }
    })
  } else {
    console.log('   None - All status codes are handleable!')
  }

  if (results.errors.length > 0) {
    console.log(`\n⚠️  ERRORS ENCOUNTERED (${results.errors.length}):`)
    console.log('-'.repeat(40))
    results.errors.slice(0, 10).forEach(error => {
      // Show first 10 errors
      console.log(`   ${error.statusCode}: ${error.error}`)
    })
    if (results.errors.length > 10) {
      console.log(`   ... and ${results.errors.length - 10} more errors`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(
    `📈 SUMMARY: ${results.handleable.length} handleable, ${results.unhandleable.length} unhandleable`
  )
  console.log('='.repeat(60))
}

/**
 * Groups consecutive numbers into ranges for display
 * @param {number[]} numbers - Array of numbers to group
 * @returns {Array<{start: number, end: number}>} - Array of ranges
 */
function groupConsecutiveNumbers (numbers) {
  if (numbers.length === 0) return []

  const sorted = [...numbers].sort((a, b) => a - b)
  const ranges = []
  let start = sorted[0]
  let end = sorted[0]

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i]
    } else {
      ranges.push({ start, end })
      start = sorted[i]
      end = sorted[i]
    }
  }

  ranges.push({ start, end })
  return ranges
}

/**
 * Main execution function
 */
async function main () {
  let server = null

  try {
    const fs = require('fs')
    const filename = 'scripts/status-codes.json'

    // Check if the file already exists
    const forceRegenerate = process.argv.includes('--force')
    if (fs.existsSync(filename) && !forceRegenerate) {
      console.log(`✅ Status codes file already exists: ${filename}`)
      console.log('ℹ️ Delete the file to regenerate or use --force flag')
      return
    }

    console.log('🚀 Starting HTTP Status Code Testing Tool')
    if (forceRegenerate && fs.existsSync(filename)) {
      console.log('🔄 Force regenerating existing status codes file')
    }
    console.log(`📋 Testing range: ${STATUS_CODE_RANGE_START} to ${STATUS_CODE_RANGE_END}`)

    // Create test server
    server = await createTestServer(SERVER_PORT)

    // Generate status codes to test
    const statusCodes = generateStatusCodes(STATUS_CODE_RANGE_START, STATUS_CODE_RANGE_END)

    // Test all status codes
    const results = await testAllStatusCodes(statusCodes, SERVER_PORT)

    // Display results
    displayResults(results)

    // Generate status codes array in the requested format
    const statusCodesArray = []

    // Create a map of error status codes to their error messages
    const errorMap = new Map()
    results.errors.forEach(error => {
      errorMap.set(error.statusCode, error.error)
    })

    // Add handleable codes with "success" state
    results.handleable.forEach(statusCode => {
      statusCodesArray.push({
        status: statusCode,
        state: 'success'
      })
    })

    // Add unhandleable codes with appropriate state based on error type
    results.unhandleable.forEach(statusCode => {
      const errorReason = errorMap.get(statusCode) || 'Unknown error'
      const state = errorReason.includes('timeout') ? 'timedout' : 'error'
      statusCodesArray.push({
        status: statusCode,
        state
      })
    })

    // Sort by status code for better organization
    statusCodesArray.sort((a, b) => a.status - b.status)

    // Save results to scripts/status-codes.json file
    fs.writeFileSync(filename, JSON.stringify(statusCodesArray, null, 2))
    console.log(`💾 Status codes saved to: ${filename}`)
    console.log(`📊 Generated ${statusCodesArray.length} status code entries`)
  } catch (error) {
    console.error('❌ Error during testing:', error.message)
    process.exit(1)
  } finally {
    // Clean up server
    if (server) {
      server.close(() => {
        console.log('🔒 Test server closed')
        process.exit(0)
      })
    }
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...')
  process.exit(0)
})

// Run the main function if this script is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error)
    process.exit(1)
  })
}

module.exports = {
  createTestServer,
  testStatusCode,
  generateStatusCodes,
  testAllStatusCodes,
  displayResults
}

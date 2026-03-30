// Test script to verify the planning-context endpoint works correctly
import http from 'http'

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/projects/test-project-id/planning-context',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer test-token',
    'Content-Type': 'application/json'
  }
}

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('Status:', res.statusCode)
    console.log('Response:', data)
  })
})

req.on('error', (error) => {
  console.error('Error:', error)
})

req.end()

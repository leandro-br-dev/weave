const curl = require('child_process').execSync;

const API_URL = 'http://localhost:3000';
const TOKEN = '1d10162d2e6fc4f0207eeb72d674881f76aea61d947ccc51';

console.log('Testing authentication...');
console.log('Token:', TOKEN);
console.log('');

try {
  const result = curl(
    `curl -s -X GET "${API_URL}/api/projects" -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json"`,
    { encoding: 'utf-8' }
  );
  console.log('Response:', result);
} catch (e) {
  console.error('Error:', e.message);
}

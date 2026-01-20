/**
 * Test Qdrant Connection
 */

import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

console.log('Testing Qdrant connection...');
console.log('QDRANT_URL:', QDRANT_URL);
console.log('QDRANT_API_KEY:', QDRANT_API_KEY ? QDRANT_API_KEY.substring(0, 20) + '...' : 'NOT SET');

if (!QDRANT_URL) {
  console.error('❌ QDRANT_URL not set');
  process.exit(1);
}

// Test direct fetch
const testUrl = QDRANT_URL.endsWith('/') ? QDRANT_URL.slice(0, -1) : QDRANT_URL;
const headers: Record<string, string> = {};

if (QDRANT_API_KEY) {
  headers['api-key'] = QDRANT_API_KEY;
}

console.log('\nFetching:', `${testUrl}/`);

fetch(`${testUrl}/`, { headers })
  .then(async (response) => {
    console.log('Status:', response.status, response.statusText);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Connected!');
      console.log('Response:', JSON.stringify(data, null, 2));
    } else {
      const text = await response.text();
      console.error('❌ Connection failed');
      console.error('Response:', text);
    }
  })
  .catch((error) => {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause);
    }
  });

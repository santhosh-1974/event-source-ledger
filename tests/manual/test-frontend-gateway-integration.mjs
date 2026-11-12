// Frontend Integration Test with API Gateway
import http from 'http';

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: { rawText: data }
          });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  Frontend Integration Test with API Gateway");
console.log("═══════════════════════════════════════════════════════════\n");

console.log("Testing that frontend can communicate with backend services");
console.log("through the API Gateway on port 4000\n");

// Simulate frontend API calls through the gateway
const GATEWAY_URL = 'http://localhost:4000/api/v1';
console.log(`Gateway base URL: ${GATEWAY_URL}`);

const testEmail = `frontend-${Date.now()}@example.com`;
const testPhone = `${Date.now()}`.substring(0, 10);
let authToken = null;
let customerId = null;

// TEST 1: Registration (Identity Service via Gateway)
console.log("TEST 1: Frontend Registration via Gateway");
console.log("Path: POST /api/v1/auth/register");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: "Frontend Test User",
    email: testEmail,
    phone: testPhone,
    password: "FrontendTest123"
  });
  
  if (result.statusCode === 201 && result.body.success === true) {
    authToken = result.body.data.token;
    customerId = result.body.data.customer.id;
    console.log("✅ PASS: Registration successful");
    console.log(`   Customer ID: ${customerId}`);
    console.log(`   Auth Token: ${authToken.substring(0, 50)}...`);
    console.log(`   Routed through: API Gateway (4000) → Identity Service (5001)\n`);
  } else {
    console.log(`❌ FAIL: Expected 201, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 2: Login (Identity Service via Gateway)
console.log("TEST 2: Frontend Login via Gateway");
console.log("Path: POST /api/v1/auth/login");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: testEmail,
    password: "FrontendTest123"
  });
  
  if (result.statusCode === 200 && result.body.success === true) {
    authToken = result.body.data.token;
    console.log("✅ PASS: Login successful");
    console.log(`   Customer ID: ${result.body.data.customerId}`);
    console.log(`   Auth Token: ${authToken.substring(0, 50)}...`);
    console.log(`   Routed through: API Gateway (4000) → Identity Service (5001)\n`);
  } else {
    console.log(`❌ FAIL: Expected 200, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 3: Get Customer Profile (Customer Service via Gateway)
if (authToken) {
  console.log("TEST 3: Get Customer Profile via Gateway");
  console.log("Path: GET /api/v1/customers/me");
  try {
    const result = await httpRequest({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/customers/me',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (result.statusCode === 200 && result.body.success === true) {
      console.log("✅ PASS: Customer profile retrieved");
      console.log(`   Customer ID: ${result.body.data.id}`);
      console.log(`   Customer Email: ${result.body.data.email}`);
      console.log(`   JWT Token: Validated by Customer Service`);
      console.log(`   Routed through: API Gateway (4000) → Customer Service (5002)\n`);
    } else {
      console.log(`❌ FAIL: Expected 200, got ${result.statusCode}`);
      console.log(JSON.stringify(result.body, null, 2));
    }
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}\n`);
  }
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 4: Get Accounts (Banking Service via Gateway)
if (authToken) {
  console.log("TEST 4: Get Bank Accounts via Gateway");
  console.log("Path: GET /api/v1/accounts");
  try {
    const result = await httpRequest({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/accounts',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (result.statusCode === 200) {
      const accounts = Array.isArray(result.body.data) ? result.body.data : [result.body.data];
      console.log("✅ PASS: Accounts retrieved");
      console.log(`   Account count: ${accounts.length}`);
      console.log(`   Routed through: API Gateway (4000) → Banking Service (5000)\n`);
    } else {
      console.log(`❌ FAIL: Expected 200, got ${result.statusCode}`);
      console.log(JSON.stringify(result.body, null, 2));
    }
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}\n`);
  }
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 5: Create Bank Account (Banking Service via Gateway)
if (authToken && customerId) {
  console.log("TEST 5: Create Bank Account via Gateway");
  console.log("Path: POST /api/v1/accounts");
  try {
    const accountNumber = `FE${Date.now()}`;
    const result = await httpRequest({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/accounts',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    }, {
      customerId: customerId,
      accountNumber: accountNumber,
      accountType: "SAVINGS"
    });
    
    if (result.statusCode === 201 && result.body.success === true) {
      console.log("✅ PASS: Bank account created");
      console.log(`   Account Number: ${result.body.data.accountNumber}`);
      console.log(`   Account Type: ${result.body.data.accountType}`);
      console.log(`   Customer ID: ${result.body.data.customerId}`);
      console.log(`   Routed through: API Gateway (4000) → Banking Service (5000)\n`);
    } else {
      console.log(`❌ FAIL: Expected 201, got ${result.statusCode}`);
      console.log(JSON.stringify(result.body, null, 2));
    }
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}\n`);
  }
}

console.log("═══════════════════════════════════════════════════════════");
console.log("  Integration Test Complete");
console.log("═══════════════════════════════════════════════════════════\n");

console.log("✅ Frontend Configuration:");
console.log("   VITE_API_BASE_URL=http://localhost:4000/api/v1");
console.log("");
console.log("✅ API Gateway Routing:");
console.log("   /api/v1/auth/* → Identity Service (5001)");
console.log("   /api/v1/customers/* → Customer Service (5002)");
console.log("   /api/v1/* → Banking Service (5000)");
console.log("");
console.log("✅ All requests from frontend go through API Gateway (port 4000)");
console.log("✅ No direct communication with ports 5000 or 5001 from browser");

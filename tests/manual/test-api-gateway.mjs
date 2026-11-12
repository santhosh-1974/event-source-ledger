// API Gateway Integration Tests
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

console.log("=== API Gateway Integration Tests ===\n");

// TEST 1: Health check
console.log("TEST 1: API Gateway health check");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/health',
    method: 'GET'
  });
  
  if (result.statusCode === 200 && result.body.status === "UP") {
    console.log("✅ PASS: API Gateway is healthy");
    console.log(`   Status: ${result.body.status}`);
    console.log(`   Service: ${result.body.service}\n`);
  } else {
    console.log(`❌ FAIL: Expected 200 with status UP, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

// TEST 2: Register through API Gateway (routes to Identity Service)
console.log("TEST 2: Register user through API Gateway");
const testEmail = `gateway-test-${Date.now()}@example.com`;
const testPhone = `${Date.now()}`.substring(0, 10);
let authToken = null;
let customerId = null;

try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: "Gateway Test User",
    email: testEmail,
    phone: testPhone,
    password: "TestPassword123"
  });
  
  if (result.statusCode === 201 && result.body.success === true) {
    authToken = result.body.data.token;
    customerId = result.body.data.customer.id;
    console.log("✅ PASS: Registration successful via gateway");
    console.log(`   Customer ID: ${customerId}`);
    console.log(`   Token received: ${authToken.substring(0, 50)}...\n`);
  } else {
    console.log(`❌ FAIL: Expected 201, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 3: Login through API Gateway
console.log("TEST 3: Login through API Gateway");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: testEmail,
    password: "TestPassword123"
  });
  
  if (result.statusCode === 200 && result.body.success === true) {
    authToken = result.body.data.token;
    console.log("✅ PASS: Login successful via gateway");
    console.log(`   Customer ID: ${result.body.data.customerId}`);
    console.log(`   Token received: ${authToken.substring(0, 50)}...\n`);
  } else {
    console.log(`❌ FAIL: Expected 200, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 4: Access Banking Service through Gateway (authenticated)
if (authToken) {
  console.log("TEST 4: Get customer profile through API Gateway (Customer Service)");
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
      console.log("✅ PASS: Customer Service accessible via gateway");
      console.log(`   Customer ID: ${result.body.data.id}`);
      console.log(`   Customer Email: ${result.body.data.email}\n`);
    } else {
      console.log(`❌ FAIL: Expected 200, got ${result.statusCode}`);
      console.log(JSON.stringify(result.body, null, 2));
    }
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}\n`);
  }
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 5: Verify internal endpoint is blocked
console.log("TEST 5: Verify internal customer provisioning endpoint is blocked");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/internal/customers',
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'x-internal-service-secret': 'any-secret'
    }
  }, {
    name: "Test",
    email: "test@test.com",
    phone: "1234567890"
  });
  
  if (result.statusCode === 404) {
    console.log("✅ PASS: Internal endpoint blocked by gateway");
    console.log(`   Status: ${result.statusCode} Not Found`);
    console.log(`   Message: ${result.body.message}\n`);
  } else {
    console.log(`❌ FAIL: Expected 404, got ${result.statusCode}`);
    console.log(`   Internal endpoints should not be accessible through gateway!`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 6: Create bank account through gateway
if (authToken && customerId) {
  console.log("TEST 6: Create bank account through API Gateway");
  try {
    const accountNumber = `GW${Date.now()}`;
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
      console.log("✅ PASS: Bank account created via gateway");
      console.log(`   Account Number: ${result.body.data.accountNumber}`);
      console.log(`   Account Type: ${result.body.data.accountType}\n`);
    } else {
      console.log(`❌ FAIL: Expected 201, got ${result.statusCode}`);
      console.log(JSON.stringify(result.body, null, 2));
    }
  } catch (err) {
    console.log(`❌ FAIL: ${err.message}\n`);
  }
}

console.log("=== API Gateway Tests Complete ===");
console.log("\nSummary:");
console.log("- Health check");
console.log("- Authentication routing (Identity Service)");
console.log("- Customer profile routing (Customer Service)");
console.log("- Banking operations routing (Banking Service)");
console.log("- Internal endpoint protection");
console.log("- JWT token forwarding");

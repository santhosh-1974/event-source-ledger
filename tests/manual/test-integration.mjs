// Integration Test Suite for Identity, Customer, and Banking Services
import http from 'http';

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data ? JSON.parse(data) : null
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

console.log("=== Identity Service & Monolith Integration Tests ===\n");

// TEST 5: Login with INCORRECT password
try {
  console.log("TEST 5: Login with incorrect password");
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: "test@integration.com",
    password: "WrongPassword"
  });
  
  if (result.statusCode === 401 && result.body.success === false) {
    console.log("✅ PASS: Invalid credentials rejected (401)");
    console.log(`   Message: ${result.body.message}\n`);
  } else {
    console.log(`❌ FAIL: Expected 401, got ${result.statusCode}\n`);
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

// TEST 6: Registration with existing email
try {
  console.log("TEST 6: Registration with existing email");
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: "Duplicate User",
    email: "test@integration.com",
    phone: "8888888888",
    password: "AnotherPassword123"
  });
  
  if (result.statusCode === 409 && result.body.success === false) {
    console.log("✅ PASS: Duplicate email rejected (409)");
    console.log(`   Message: ${result.body.message}\n`);
  } else {
    console.log(`❌ FAIL: Expected 409, got ${result.statusCode}\n`);
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

// TEST 7: Get valid JWT and test Customer Service through the Gateway
try {
  console.log("TEST 7: Verify Identity JWT through Customer Service");
  
  // Step 1: Login to get JWT
  const loginResult = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: "test@integration.com",
    password: "SecureP@ssw0rd123"
  });
  
  if (loginResult.statusCode !== 200) {
    throw new Error(`Login failed: ${loginResult.statusCode}`);
  }
  
  const token = loginResult.body.data.token;
  console.log(`   Got JWT token (first 50 chars): ${token.substring(0, 50)}...`);
  
  // Step 2: Use JWT with the customer profile endpoint through the Gateway
  const customerResult = await httpRequest({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/customers/me',
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (customerResult.statusCode === 200 && customerResult.body.success === true) {
    console.log("✅ PASS: JWT verified successfully by Customer Service");
    console.log(`   Customer ID: ${customerResult.body.data.id}`);
    console.log(`   Customer Email: ${customerResult.body.data.email}\n`);
  } else {
    console.log(`❌ FAIL: Expected 200, got ${customerResult.statusCode}\n`);
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

// TEST 8: Call banking endpoint with JWT from Identity Service
try {
  console.log("TEST 8: Call authenticated banking endpoint using JWT");
  
  // Login to get token
  const loginResult = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: "test@integration.com",
    password: "SecureP@ssw0rd123"
  });
  
  const token = loginResult.body.data.token;
  const customerId = loginResult.body.data.customerId;
  
  // Create a bank account first
  const accountResult = await httpRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/v1/accounts',
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }, {
    accountType: "SAVINGS"
  });
  
  if (accountResult.statusCode === 201) {
    const accountNumber = accountResult.body.data.accountNumber;
    console.log(`✅ PASS: Created bank account: ${accountNumber}`);
    console.log(`   Account belongs to customer: ${customerId}\n`);
  } else {
    console.log(`❌ FAIL: Could not create account: ${accountResult.statusCode}`);
    console.log(`   ${JSON.stringify(accountResult.body)}\n`);
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}\n`);
}

console.log("=== Tests Complete ===");

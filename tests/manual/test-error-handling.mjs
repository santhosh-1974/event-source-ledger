// Comprehensive Error Handling Tests for Identity Service
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
            body: data ? JSON.parse(data) : null
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
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

console.log("=== Identity Service Error Handling Tests ===\n");

// Setup: Create a test user
console.log("Setup: Creating test user for error tests");
const setupResult = await httpRequest({
  hostname: 'localhost',
  port: 5001,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, {
  name: "Error Test User",
  email: "error-test@example.com",
  phone: "7777777777",
  password: "TestPassword123"
});

if (setupResult.statusCode !== 201) {
  console.log(`❌ Setup failed: ${setupResult.statusCode}`);
  console.log(JSON.stringify(setupResult.body, null, 2));
  process.exit(1);
}

console.log(`✅ Setup complete: User created with ID ${setupResult.body.data.customer.id}\n`);

// Wait a moment for service to stabilize
await new Promise(resolve => setTimeout(resolve, 500));

// TEST 1: Login with incorrect password
console.log("TEST 1: Login with incorrect password");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: "error-test@example.com",
    password: "WrongPassword123"
  });
  
  if (result.statusCode === 401) {
    console.log("✅ PASS: Status 401 Unauthorized");
    console.log(`   Message: ${result.body.message}`);
    console.log(`   Success flag: ${result.body.success}`);
    
    // Verify no sensitive data leaked
    const bodyStr = JSON.stringify(result.body);
    if (bodyStr.includes('password') || bodyStr.includes('hash') || bodyStr.includes('secret')) {
      console.log("⚠️  WARNING: Response may contain sensitive data");
    } else {
      console.log("   ✓ No sensitive data in response");
    }
  } else {
    console.log(`❌ FAIL: Expected 401, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 2: Check service is still running after error
console.log("\nTEST 2: Verify service remains running after authentication error");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/health',
    method: 'GET'
  });
  
  if (result.statusCode === 200) {
    console.log("✅ PASS: Service is still running");
    console.log(`   Health check: ${JSON.stringify(result.body)}`);
  } else {
    console.log(`❌ FAIL: Health check returned ${result.statusCode}`);
  }
} catch (err) {
  console.log(`❌ FAIL: Service crashed - ${err.message}`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 3: Registration with existing email
console.log("\nTEST 3: Registration with existing email");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: "Duplicate User",
    email: "error-test@example.com",
    phone: "6666666666",
    password: "AnotherPassword123"
  });
  
  if (result.statusCode === 409) {
    console.log("✅ PASS: Status 409 Conflict");
    console.log(`   Message: ${result.body.message}`);
    console.log(`   Success flag: ${result.body.success}`);
  } else {
    console.log(`❌ FAIL: Expected 409, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 4: Check service is still running after conflict error
console.log("\nTEST 4: Verify service remains running after conflict error");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/health',
    method: 'GET'
  });
  
  if (result.statusCode === 200) {
    console.log("✅ PASS: Service is still running");
  } else {
    console.log(`❌ FAIL: Health check returned ${result.statusCode}`);
  }
} catch (err) {
  console.log(`❌ FAIL: Service crashed - ${err.message}`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 5: Registration with invalid input (missing required fields)
console.log("\nTEST 5: Registration with invalid input");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: "Incomplete User",
    email: "incomplete@example.com"
    // Missing phone and password
  });
  
  if (result.statusCode === 400) {
    console.log("✅ PASS: Status 400 Bad Request");
    console.log(`   Message: ${result.body.message}`);
    if (result.body.errors && Array.isArray(result.body.errors)) {
      console.log(`   Validation errors: ${result.body.errors.length} fields`);
    }
  } else {
    console.log(`❌ FAIL: Expected 400, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 6: Check service is still running after validation error
console.log("\nTEST 6: Verify service remains running after validation error");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/health',
    method: 'GET'
  });
  
  if (result.statusCode === 200) {
    console.log("✅ PASS: Service is still running");
  } else {
    console.log(`❌ FAIL: Health check returned ${result.statusCode}`);
  }
} catch (err) {
  console.log(`❌ FAIL: Service crashed - ${err.message}`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// TEST 7: Valid login after all errors (service resilience)
console.log("\nTEST 7: Valid login still succeeds after multiple errors");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    email: "error-test@example.com",
    password: "TestPassword123"
  });
  
  if (result.statusCode === 200 && result.body.success === true) {
    console.log("✅ PASS: Login succeeded");
    console.log(`   Customer ID: ${result.body.data.customerId}`);
    console.log(`   Token received: ${result.body.data.token.substring(0, 50)}...`);
  } else {
    console.log(`❌ FAIL: Expected 200, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}`);
}

console.log("\n=== All Error Handling Tests Complete ===");

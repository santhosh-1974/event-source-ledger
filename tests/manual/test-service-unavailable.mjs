// Test Customer Service Unavailability
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
        } catch (err) {
          resolve({
            statusCode: res.statusCode,
            body: { rawText: data }
          });
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

console.log("=== Customer Service Unavailability Test ===\n");

console.log("TEST: Registration when Customer Service is unavailable");
console.log("(Monolith should be stopped for this test)\n");

try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/api/v1/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: "Unavailable Test User",
    email: "unavailable-test@example.com",
    phone: "8888888888",
    password: "TestPassword123"
  });
  
  if (result.statusCode === 503) {
    console.log("✅ PASS: Status 503 Service Unavailable");
    console.log(`   Message: ${result.body.message}`);
    console.log(`   Success flag: ${result.body.success}`);
    
    // Verify no sensitive data leaked
    const bodyStr = JSON.stringify(result.body);
    if (bodyStr.includes('secret') || bodyStr.includes('CUSTOMER_PROVISIONING_SECRET')) {
      console.log("❌ FAIL: Response contains internal secrets!");
    } else {
      console.log("   ✓ No internal secrets in response");
    }
  } else {
    console.log(`❌ FAIL: Expected 503, got ${result.statusCode}`);
    console.log(JSON.stringify(result.body, null, 2));
  }
} catch (err) {
  console.log(`❌ FAIL: ${err.message}`);
}

await new Promise(resolve => setTimeout(resolve, 500));

// Check service is still running
console.log("\nVerifying Identity Service remains running:");
try {
  const result = await httpRequest({
    hostname: 'localhost',
    port: 5001,
    path: '/health',
    method: 'GET'
  });
  
  if (result.statusCode === 200) {
    console.log("✅ PASS: Service is still running after Customer Service failure");
  } else {
    console.log(`❌ FAIL: Health check returned ${result.statusCode}`);
  }
} catch (err) {
  console.log(`❌ FAIL: Service crashed - ${err.message}`);
}

console.log("\n=== Test Complete ===");

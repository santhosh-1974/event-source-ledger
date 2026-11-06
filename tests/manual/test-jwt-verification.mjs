// Test JWT compatibility between Identity Service and Monolith
import http from 'http';

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: data ? JSON.parse(data) : null
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

console.log("=== JWT Verification Test ===\n");

// Login through Identity Service
console.log("Step 1: Login through Identity Service (port 5001)");
const loginResult = await httpRequest({
  hostname: 'localhost',
  port: 5001,
  path: '/api/v1/auth/register',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, {
  name: "JWT Test User",
  email: "jwt-test@example.com",
  phone: "5555555555",
  password: "TestPassword123"
});

if (loginResult.statusCode !== 201) {
  console.log(`❌ Registration failed: ${loginResult.statusCode}`);
  console.log(JSON.stringify(loginResult.body, null, 2));
  process.exit(1);
}

const token = loginResult.body.data.token;
const customerId = loginResult.body.data.customer.id;

console.log(`✅ Registration successful`);
console.log(`   Customer ID: ${customerId}`);
console.log(`   Token: ${token.substring(0, 50)}...\n`);

// Use JWT with monolith
console.log("Step 2: Use JWT with monolith protected endpoint (port 5000)");
const customerResult = await httpRequest({
  hostname: 'localhost',
  port: 5000,
  path: '/api/v1/customers/me',
  method: 'GET',
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

if (customerResult.statusCode === 200 && customerResult.body.success === true) {
  console.log("✅ JWT verified successfully by monolith!");
  console.log(`   Customer ID from monolith: ${customerResult.body.data.id}`);
  console.log(`   Customer Email: ${customerResult.body.data.email}`);
  console.log(`   IDs match: ${customerResult.body.data.id === customerId}\n`);
} else {
  console.log(`❌ JWT verification failed: ${customerResult.statusCode}`);
  console.log(JSON.stringify(customerResult.body, null, 2));
  process.exit(1);
}

// Create bank account using JWT
console.log("Step 3: Create bank account using JWT");
const accountNumber = `ACC${Date.now()}`;
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
  customerId: customerId,
  accountNumber: accountNumber,
  accountType: "SAVINGS"
});

if (accountResult.statusCode === 201) {
  console.log(`✅ Bank account created successfully!`);
  console.log(`   Account Number: ${accountResult.body.data.accountNumber}`);
  console.log(`   Account Type: ${accountResult.body.data.accountType}`);
  console.log(`   Customer ID: ${accountResult.body.data.customerId}\n`);
} else {
  console.log(`❌ Account creation failed: ${accountResult.statusCode}`);
  console.log(JSON.stringify(accountResult.body, null, 2));
}

console.log("=== All Tests Passed ===");

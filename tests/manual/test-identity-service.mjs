// Test Identity Service Integration

const BASE_URL = "http://localhost:5001/api/v1/auth";

async function test(name, fn) {
  try {
    await fn();
    console.log(`✅ PASS: ${name}`);
  } catch (error) {
    console.log(`❌ FAIL: ${name}`);
    console.log(`   Reason: ${error.message}`);
  }
}

// Test 5: Login with incorrect password
await test("Login with incorrect password", async () => {
  const response = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@integration.com",
      password: "WrongPassword123"
    })
  });
  
  const data = await response.json();
  
  if (response.status !== 401) {
    throw new Error(`Expected 401, got ${response.status}`);
  }
  if (data.success !== false) {
    throw new Error("Expected success=false");
  }
  if (!data.message.includes("Invalid")) {
    throw new Error(`Expected error message about invalid credentials, got: ${data.message}`);
  }
  console.log(`   Status: ${response.status}, Message: ${data.message}`);
});

// Test 6: Registration with existing email
await test("Registration with existing email", async () => {
  const response = await fetch(`${BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Another User",
      email: "test@integration.com",
      phone: "9999999999",
      password: "AnotherPassword123"
    })
  });
  
  const data = await response.json();
  
  if (response.status !== 409) {
    throw new Error(`Expected 409, got ${response.status}`);
  }
  if (data.success !== false) {
    throw new Error("Expected success=false");
  }
  console.log(`   Status: ${response.status}, Message: ${data.message}`);
});

console.log("\n--- Tests Complete ---");

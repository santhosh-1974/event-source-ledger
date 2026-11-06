export default async function run(page, ui) {
  const snapshot = await ui.snapshot();
  console.log('Initial snapshot:', snapshot);

  // Fill in the login form
  await ui.fill('@e1', 'test@example.com');
  await ui.fill('@e2', 'password1234567890');

  // Click login
  await ui.click('@e3');

  // Wait for navigation or response
  await page.waitForTimeout(2000);

  // Check the result
  const afterSnapshot = await ui.snapshot();
  console.log('After login:', afterSnapshot);

  // Check if we're on a different page
  const url = page.url();
  console.log('Current URL:', url);

  return {
    success: !url.includes('/login'),
    url,
    snapshot: afterSnapshot
  };
}

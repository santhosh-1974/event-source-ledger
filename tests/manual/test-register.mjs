export default async function run(page, ui) {
  const snapshot = await ui.snapshot();
  console.log('Initial snapshot:', snapshot);

  // Fill in the registration form
  await ui.fill('@e1', 'Test User');
  await ui.fill('@e2', 'test@example.com');
  await ui.fill('@e3', '1234567890');
  await ui.fill('@e4', 'password1234567890');
  await ui.fill('@e5', 'password1234567890');

  // Click register
  await ui.click('@e6');

  // Wait for navigation or response
  await page.waitForTimeout(2000);

  // Check the result
  const afterSnapshot = await ui.snapshot();
  console.log('After register:', afterSnapshot);

  // Check if we're on a different page
  const url = page.url();
  console.log('Current URL:', url);

  return {
    success: !url.includes('/register'),
    url,
    snapshot: afterSnapshot
  };
}

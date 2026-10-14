import { test, expect } from 'playwright-test-coverage';
import { basicInit } from './helpers';

test('updateUser - updates diner information', async ({ page }) => {
  await basicInit(page);

  const email = `user${Date.now()}@jwt.com`;

  // Register a new diner
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();

  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');

  await page.getByRole('button', { name: 'Register' }).click();

  // Navigate to diner dashboard
  await page.getByRole('link', { name: 'pd' }).click();
  await expect(page.getByRole('main')).toContainText('pizza diner');

  // Open edit dialog
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Update user information
  await page.getByRole('textbox', { name: 'Name:' }).fill('pizza diner updated');

  // Listen for the PUT request
  const updateRequestPromise = page.waitForRequest(
    request =>
      request.method() === 'PUT' &&
      /\/api\/user\/[^/?]+$/.test(request.url())
  );

  await page.getByRole('button', { name: 'Update' }).click();

  // Verify the PUT request
  const updateRequest = await updateRequestPromise;

  expect(updateRequest.postDataJSON()).toMatchObject({
    name: 'pizza diner updated',
    email,
  });

  // Verify dialog closes and UI updates
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('main')).toContainText('pizza diner updated');

  // Logout
  await page.getByRole('link', { name: 'Logout' }).click();

  // Login again
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');

  await page.getByRole('button', { name: 'Login' }).click();

  // Return to diner dashboard
  await page.getByRole('link', { name: 'pu' }).click();

  // Verify updated information persists after login
  await expect(page.getByRole('main')).toContainText('pizza diner updated');
  await expect(page.getByRole('main')).toContainText(email);
});

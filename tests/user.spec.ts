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


test('listUsers - admin can view and paginate users', async ({ page }) => {
  await basicInit(page);

  const requests: string[] = [];

  await page.route(/\/api\/user\?/, async (route) => {
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get('page'));
    requests.push(url.search);

    const result = pageNumber === 1
      ? {
          users: [
            { id: '101', name: 'Alice Smith', email: 'alice@example.com', roles: [{ role: 'diner' }] },
            { id: '102', name: 'Bob Jones', email: 'bob@example.com', roles: [{ role: 'franchisee' }] },
          ],
          more: true,
        }
      : {
          users: [
            { id: '103', name: 'Carol White', email: 'carol@example.com', roles: [{ role: 'admin' }] },
          ],
          more: false,
        };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(result),
    });
  });

  await page.goto('/');

  // Sign in as an admin (requires an admin user in basicInit)
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('/admin-dashboard');

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Alice Smith', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bob Jones', exact: true })).toBeVisible();
  await expect(page.getByText('Page 1')).toBeVisible();

  await page.getByRole('button', { name: 'Next users page' }).click();

  await expect(page.getByRole('cell', { name: 'Carol White', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Alice Smith', exact: true })).toHaveCount(0);
  await expect(page.getByText('Page 2')).toBeVisible();

  expect(requests.some((query) => query.includes('page=1'))).toBe(true);
  expect(requests.some((query) => query.includes('page=2'))).toBe(true);
});

test('listUsers - admin can filter users by name', async ({ page }) => {
  await basicInit(page);

  const requestedFilters: string[] = [];

  await page.route(/\/api\/user\?/, async (route) => {
    const url = new URL(route.request().url());
    const filter = url.searchParams.get('name') ?? '*';
    requestedFilters.push(filter);

    const users = filter.includes('Alice')
      ? [{ id: '101', name: 'Alice Smith', email: 'alice@example.com', roles: [{ role: 'diner' }] }]
      : [
          { id: '101', name: 'Alice Smith', email: 'alice@example.com', roles: [{ role: 'diner' }] },
          { id: '102', name: 'Bob Jones', email: 'bob@example.com', roles: [{ role: 'diner' }] },
        ];

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ users, more: false }),
    });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('/admin-dashboard');

  await expect(page.getByRole('cell', { name: 'Bob Jones', exact: true })).toBeVisible();

  await page.getByRole('textbox', { name: 'Filter users by name' }).fill('Alice');
  await page.getByRole('button', { name: 'Submit' }).last().click();

  await expect(page.getByRole('cell', { name: 'Alice Smith', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Bob Jones', exact: true })).toHaveCount(0);

  expect(requestedFilters).toContain('*Alice*');
});


test('deleteUser - admin can delete a user', async ({ page }) => {
  await basicInit(page);

  let deleted = false;
  let deletedUserId = '';

  await page.route(/\/api\/user(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      json: {
        users: deleted
          ? []
          : [
              {
                id: '101',
                name: 'Alice Smith',
                email: 'alice@example.com',
                roles: [{ role: 'diner' }],
              },
            ],
        more: false,
      },
    });
  });

  await page.route(/\/api\/user\/101$/, async (route) => {
    if (route.request().method() === 'DELETE') {
      deletedUserId = '101';
      deleted = true;
      await route.fulfill({ status: 200, json: { message: 'User deleted' } });
      return;
    }

    await route.fallback();
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('admin');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.goto('/admin-dashboard');

  await expect(page.getByRole('cell', { name: 'Alice Smith', exact: true })).toBeVisible();

  // Cancel deletion first
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Delete Alice Smith' }).click();

  await expect(page.getByRole('cell', { name: 'Alice Smith', exact: true })).toBeVisible();
  expect(deleted).toBe(false);

  // Confirm deletion
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete Alice Smith' }).click();

  await expect(page.getByRole('cell', { name: 'Alice Smith', exact: true })).toHaveCount(0);

  expect(deletedUserId).toBe('101');
});

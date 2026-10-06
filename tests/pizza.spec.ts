import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;

  const validUsers: Record<string, User> = {
    'd@jwt.com': {
      id: '3',
      name: 'Kai Chen',
      email: 'd@jwt.com',
      password: 'diner',
      roles: [{ role: Role.Diner }],
    },
    'f@jwt.com': {
      id: '4',
      name: 'Franchise Owner',
      email: 'f@jwt.com',
      password: 'franchise',
      roles: [{ role: Role.Franchisee, objectId: '2' }],
    },
    'a@jwt.com': {
      id: '1',
      name: 'Admin User',
      email: 'a@jwt.com',
      password: 'admin',
      roles: [{ role: Role.Admin }],
    },
  };

  // Login and registration
  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      const registerReq = route.request().postDataJSON();

      loggedInUser = {
        id: '10',
        name: registerReq.name,
        email: registerReq.email,
        roles: [{ role: Role.Diner }],
      };

      await route.fulfill({
        json: {
          user: loggedInUser,
          token: 'abcdef',
        },
      });
      return;
    }

    if (method === 'PUT') {
      const loginReq = route.request().postDataJSON();
      const user = validUsers[loginReq.email];

      if (!user || user.password !== loginReq.password) {
        await route.fulfill({
          status: 401,
          json: {
            message: 'Unauthorized',
          },
        });
        return;
      }

      loggedInUser = user;

      await route.fulfill({
        json: {
          user: loggedInUser,
          token: 'abcdef',
        },
      });
      return;
    }

    if (method === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ json: {} });
      return;
    }

    await route.fallback();
  });

  // Current logged-in user
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // Menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      {
        id: 1,
        title: 'Veggie',
        image: 'pizza1.png',
        price: 0.0038,
        description: 'A garden of delight',
      },
      {
        id: 2,
        title: 'Pepperoni',
        image: 'pizza2.png',
        price: 0.0042,
        description: 'Spicy treat',
      },
    ];

    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  // Franchise belonging to franchise user
  await page.route('*/**/api/franchise/4', async (route) => {
    expect(route.request().method()).toBe('GET');

    await route.fulfill({
      json: [
        {
          id: 2,
          name: 'LotaPizza',
          admins: [
            {
              id: '4',
              name: 'Franchise Owner',
              email: 'f@jwt.com',
            },
          ],
          stores: [
            {
              id: 4,
              name: 'Lehi',
              totalRevenue: 42,
            },
          ],
        },
      ],
    });
  });

  // Franchise list
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const franchiseReq = route.request().postDataJSON();

      await route.fulfill({
        json: {
          ...franchiseReq,
          id: '9',
          stores: [],
        },
      });
      return;
    }

    expect(route.request().method()).toBe('GET');

    await route.fulfill({
      json: {
        franchises: [
          {
            id: 2,
            name: 'LotaPizza',
            admins: [
              {
                id: '4',
                name: 'Franchise Owner',
                email: 'f@jwt.com',
              },
            ],
            stores: [
              {
                id: 4,
                name: 'Lehi',
                totalRevenue: 42,
              },
            ],
          },
          {
            id: 3,
            name: 'PizzaCorp',
            admins: [],
            stores: [
              {
                id: 7,
                name: 'Spanish Fork',
                totalRevenue: 20,
              },
            ],
          },
        ],
        more: false,
      },
    });
  });

  // Franchise and store management mutations
  await page.route(/\/api\/franchise\/[^/]+$/, async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }

    await route.fulfill({ json: {} });
  });

  await page.route(/\/api\/franchise\/[^/]+\/store$/, async (route) => {
    expect(route.request().method()).toBe('POST');
    const storeReq = route.request().postDataJSON();

    await route.fulfill({
      json: {
        ...storeReq,
        id: '8',
        totalRevenue: 0,
      },
    });
  });

  await page.route(/\/api\/franchise\/[^/]+\/store\/[^/]+$/, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    await route.fulfill({ json: null });
  });

  // JWT verification at the pizza factory
  await page.route('**/api/order/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({
      json: {
        message: 'valid',
        payload: { orderId: 23, message: 'Fresh from the factory' },
      },
    });
  });

  // Orders
  await page.route('*/**/api/order', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        json: {
          orders: [
            {
              id: 23,
              items: [
                {
                  menuId: 1,
                  description: 'Veggie',
                  price: 0.0038,
                },
                {
                  menuId: 2,
                  description: 'Pepperoni',
                  price: 0.0042,
                },
              ],
              storeId: 4,
              franchiseId: 2,
              date: new Date().toISOString(),
            },
          ],
        },
      });
      return;
    }

    if (method === 'POST') {
      const orderReq = route.request().postDataJSON();

      await route.fulfill({
        json: {
          order: {
            ...orderReq,
            id: 23,
          },
          jwt: 'eyJpYXQ',
        },
      });
      return;
    }

    await route.fallback();
  });

  await page.goto('/');
}

async function login(
  page: Page,
  email: string,
  password: string
) {
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}

test('home page', async ({ page }) => {
  await page.goto('/');

  expect(await page.title()).toBe('JWT Pizza');
});

test('login', async ({ page }) => {
  await basicInit(page);

  await login(page, 'd@jwt.com', 'diner');

  await expect(
    page.getByRole('link', { name: 'KC' })
  ).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('button', { name: 'Order now' }).click();

  await expect(page.locator('h2')).toContainText(
    'Awesome is a click away'
  );

  await page.getByRole('combobox').selectOption('4');

  await page
    .getByRole('link', {
      name: 'Image Description Veggie A',
    })
    .click();

  await page
    .getByRole('link', {
      name: 'Image Description Pepperoni',
    })
    .click();

  await expect(page.locator('form')).toContainText(
    'Selected pizzas: 2'
  );

  await page.getByRole('button', { name: 'Checkout' }).click();

  await page
    .getByPlaceholder('Email address')
    .fill('d@jwt.com');

  await page
    .getByPlaceholder('Password')
    .fill('diner');

  await page
    .getByRole('button', { name: 'Login' })
    .click();

  await expect(page.getByRole('main')).toContainText(
    'Send me those 2 pizzas right now!'
  );

  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');

  await page.getByRole('button', { name: 'Pay now' }).click();

  await expect(page.getByText('0.008')).toBeVisible();

  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByRole('heading', { name: /JWT Pizza - valid/ })).toBeVisible();
  await expect(page.locator('pre')).toContainText('Fresh from the factory');

  await page.getByRole('button', { name: 'Close' }).click();
});

test('register new user', async ({ page }) => {
  await basicInit(page);

  await page.getByRole('link', { name: 'Login' }).click();

  await page
    .getByText('Register instead')
    .click();

  await expect(page.getByRole('main')).toContainText(
    'Welcome to the party'
  );

  await page
    .getByPlaceholder('Full name')
    .fill('Test User');

  await page
    .getByPlaceholder('Email address')
    .fill('test@jwt.com');

  await page
    .getByPlaceholder('Password')
    .fill('pizza123');

  await page
    .getByRole('button', { name: 'Register' })
    .click();

  await expect(page.getByRole('main')).not.toContainText(
    'Welcome to the party'
  );
});

test('diner dashboard shows order history', async ({ page }) => {
  await basicInit(page);

  await login(page, 'd@jwt.com', 'diner');

  await page.goto('/diner-dashboard');

  await expect(page.getByRole('main')).toContainText(
    'Your pizza kitchen'
  );

  await expect(page.getByRole('main')).toContainText(
    'Kai Chen'
  );

  await expect(page.getByRole('main')).toContainText(
    'd@jwt.com'
  );

  await expect(page.getByRole('main')).toContainText(
    'Here is your history of all the good times.'
  );

  await expect(page.locator('table')).toContainText('23');
});

test('franchise dashboard shows stores', async ({ page }) => {
  await basicInit(page);

  await login(page, 'f@jwt.com', 'franchise');

  await page.goto('/franchise-dashboard');

  await expect(page.getByRole('main')).toContainText(
    'LotaPizza'
  );

  await expect(page.getByRole('main')).toContainText(
    'Lehi'
  );

  await expect(page.getByRole('main')).toContainText(
    '42'
  );

  await expect(
    page.getByRole('button', { name: 'Create store' })
  ).toBeVisible();
});

test('admin manages franchises and stores', async ({ page }) => {
  await basicInit(page);

  await login(page, 'a@jwt.com', 'admin');
  await page.goto('/admin-dashboard');

  await expect(page.getByRole('main')).toContainText("Mama Ricci's kitchen");
  await expect(page.getByRole('main')).toContainText('LotaPizza');
  await expect(page.getByRole('main')).toContainText('Lehi');
  await expect(page.getByRole('main')).toContainText('PizzaCorp');

  await page.getByPlaceholder('Filter franchises').fill('Pizza');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByRole('main')).toContainText('PizzaCorp');

  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await expect(page.getByRole('heading', { name: 'Create franchise' })).toBeVisible();
  await page.getByPlaceholder('franchise name').fill('New York Pizza');
  await page.getByPlaceholder('franchisee admin email').fill('owner@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).nth(0).click();
  await expect(page.getByRole('main')).toContainText('close the LotaPizza franchise');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).nth(1).click();
  await expect(page.getByRole('main')).toContainText('close the LotaPizza store Lehi');
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();
});

test('franchise owner creates a store', async ({ page }) => {
  await basicInit(page);

  await login(page, 'f@jwt.com', 'franchise');
  await page.goto('/franchise-dashboard');
  await page.getByRole('button', { name: 'Create store' }).click();

  await expect(page.getByRole('heading', { name: 'Create store' })).toBeVisible();
  await page.getByPlaceholder('store name').fill('American Fork');
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(page.getByRole('heading', { name: 'LotaPizza' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('Lehi');
});

test('logged-in user can log out', async ({ page }) => {
  await basicInit(page);

  await login(page, 'd@jwt.com', 'diner');
  await expect(page.getByRole('link', { name: 'Logout' })).toBeVisible();
  await page.getByRole('link', { name: 'Logout' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
});

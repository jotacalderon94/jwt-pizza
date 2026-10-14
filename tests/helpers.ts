import { Page } from '@playwright/test';
import { expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';
export async function basicInit(page: Page) {
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

  const passwords: Record<string, string> = {};

  for (const user of Object.values(validUsers)) {
    passwords[user.email!] = user.password!;
  }

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

      validUsers[registerReq.email]={
        ...loggedInUser,
        password: registerReq.password,
      };

      passwords[registerReq.email] = registerReq.password;

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

      if (!user || passwords[loginReq.email] !== loginReq.password) {
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

  // Update user
  await page.route(/\/api\/user\/[^/?]+$/, async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }

    const updatedUser = route.request().postDataJSON();

    const existingUser = Object.values(validUsers).find(
      (user) => user.id === updatedUser.id
    );
    const password = updatedUser.password || existingUser?.password;

    if (existingUser) {
      delete validUsers[existingUser.email!];
      delete passwords[existingUser.email!];
    }

    loggedInUser = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      roles: updatedUser.roles,
    };

    validUsers[updatedUser.email] = {
      ...loggedInUser,
      password,
    };

    passwords[updatedUser.email] = password || '';

    await route.fulfill({
      status: 200,
      json: {
        user: loggedInUser,
        token: 'updated-token',
      },
    });
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

export async function login(
  page: Page,
  email: string,
  password: string
) {
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
}



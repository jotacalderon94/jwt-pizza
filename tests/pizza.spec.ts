import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';
import { basicInit, login } from './helpers';

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
  await page.getByPlaceholder('Filter franchises').locator('..').getByRole('button', { name: 'Submit' }).click();
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


import { sleep, group, check } from 'k6';
import http from 'k6/http';

const frontend = 'https://pizza.jmcr94.click';
const backend = 'https://pizza-service.jmcr94.click';
const factory = 'https://pizza-factory.cs329.click';

export const options = {
  cloud: {
    distribution: {
      'amazon:us:ashburn': {
        loadZone: 'amazon:us:ashburn',
        percent: 100,
      },
    },
  },
  thresholds: {
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
  },
  scenarios: {
    loginAndOrder: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { target: 2, duration: '10s' },
        { target: 2, duration: '40s' },
        { target: 0, duration: '10s' },
      ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
};

export default function () {
  group('Login and order pizza', function () {
    const jsonHeaders = {
      'Content-Type': 'application/json',
    };

    // Load login page
    http.get(`${frontend}/login`);
    sleep(2.1);

    // Login
    const loginResponse = http.put(
      `${backend}/api/auth`,
      JSON.stringify({
        email: __ENV.PIZZA_EMAIL,
        password: __ENV.PIZZA_PASSWORD,
      }),
      { headers: jsonHeaders }
    );

    if (!check(loginResponse, {
      'login status is 200': (r) => r.status === 200,
    })) {
      return;
    }

    const authToken = loginResponse.json('token');

    if (!check(authToken, {
      'authentication token received': (t) =>
        typeof t === 'string' && t.length > 0,
    })) {
      return;
    }

    const authHeaders = {
      ...jsonHeaders,
      Authorization: `Bearer ${authToken}`,
    };

    sleep(4);

    // Retrieve menu
    const menuResponse = http.get(
      `${backend}/api/order/menu`,
      { headers: authHeaders }
    );

    check(menuResponse, {
      'menu status is 200': (r) => r.status === 200,
    });

    // Retrieve franchises and stores
    const franchiseResponse = http.get(
      `${backend}/api/franchise?page=0&limit=20&name=*`,
      { headers: authHeaders }
    );

    check(franchiseResponse, {
      'franchise status is 200': (r) => r.status === 200,
    });

    sleep(8.7);

    // Retrieve authenticated user
    const userResponse = http.get(
      `${backend}/api/user/me`,
      { headers: authHeaders }
    );

    check(userResponse, {
      'user status is 200': (r) => r.status === 200,
    });

    sleep(1.7);

    // Purchase pizza
    const orderResponse = http.post(
      `${backend}/api/order`,
      JSON.stringify({
        items: [
          {
            menuId: 1,
            description: 'Veggie',
            price: 0.0038,
          },
        ],
        storeId: '1',
        franchiseId: 1,
      }),
      { headers: authHeaders }
    );

    if (!check(orderResponse, {
      'purchase status is 200': (r) => r.status === 200,
    })) {
      return;
    }

    // Extract the JWT from the new purchase
    const pizzaJwt = orderResponse.json('jwt');

    if (!check(pizzaJwt, {
      'pizza JWT received': (t) =>
        typeof t === 'string' && t.length > 0,
    })) {
      return;
    }

    sleep(1.7);

    // Verify the newly purchased pizza
    const verifyResponse = http.post(
      `${factory}/api/order/verify`,
      JSON.stringify({ jwt: pizzaJwt }),
      { headers: jsonHeaders }
    );

    check(verifyResponse, {
      'pizza verification status is 200': (r) =>
        r.status === 200,
    });
  });
}
import http from 'k6/http';
import { check, sleep } from 'k6';
import { API, BASE_URL, COMMON_HEADERS, INITIAL_ACCOUNT_BALANCE } from './config.js';

export function createIdempotencyKey() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    const nibble = character === 'x' ? value : (value & 0x3) | 0x8;
    return nibble.toString(16);
  });
}

export function createHeaders(extraHeaders = {}, token = '') {
  return {
    ...COMMON_HEADERS,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extraHeaders,
  };
}

export function createWriteHeaders(token = '') {
  return createHeaders({ 'Idempotency-Key': createIdempotencyKey() }, token);
}

export function randomInt(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

export function pick(values) {
  return values[randomInt(0, values.length - 1)];
}

export function sleepBetween(minimumSeconds = 0.1, maximumSeconds = 0.5) {
  sleep(minimumSeconds + Math.random() * (maximumSeconds - minimumSeconds));
}

export function logFailure(operation, response) {
  // Keep enough context to diagnose a failed request without logging credentials.
  console.error(`${operation} failed: status=${response.status} body=${String(response.body).slice(0, 500)}`);
}

export function checkResponse(response, operation, expectedStatus, successMetric) {
  const passed = check(response, {
    [`${operation} returned ${expectedStatus}`]: (result) => result.status === expectedStatus,
    [`${operation} returned success envelope`]: (result) => {
      try {
        return result.json('success') === true;
      } catch {
        return false;
      }
    },
  });

  successMetric.add(passed, { operation });
  if (!passed) logFailure(operation, response);
  return passed;
}

function setupRequest(method, path, body, headers) {
  const response = http.request(method, `${BASE_URL}${path}`, body ? JSON.stringify(body) : null, { headers });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Load-test setup ${method} ${path} failed: ${response.status} ${response.body}`);
  }
  return response;
}

function digits(length) {
  let result = '';
  for (let index = 0; index < length; index += 1) result += randomInt(0, 9);
  return result;
}

export function provisionFundedAccounts(accountCount, historyEntries = 1) {
  const runToken = `${Date.now()}${digits(5)}`.slice(-12);
  const customer = setupRequest('POST', API.register, {
    name: 'K6 Load Test Customer',
    email: `k6-${runToken}@example.test`,
    phone: `7${runToken.slice(-6)}001`,
    password: 'k6-load-test-only-password',
  }, createHeaders()).json('data');
  const customerId = customer.customer.id;
  const accounts = [];

  for (let index = 0; index < accountCount; index += 1) {
    const token = `${runToken}${String(index).padStart(3, '0')}`;
    const accountNumber = `K6${token}`;
    setupRequest('POST', API.accounts, {
      customerId,
      accountNumber,
      accountType: 'SAVINGS',
    }, createHeaders({}, customer.token));

    // The opening deposit provides a large withdrawal/transfer buffer.
    setupRequest('POST', API.deposit, {
      accountNumber,
      amount: INITIAL_ACCOUNT_BALANCE,
    }, createWriteHeaders(customer.token));

    // Extra events let the history script exercise non-trivial pages.
    for (let event = 1; event < historyEntries; event += 1) {
      setupRequest('POST', API.deposit, { accountNumber, amount: '1.00' }, createWriteHeaders(customer.token));
    }
    accounts.push(accountNumber);
  }

  return { accounts, token: customer.token };
}

export function accountForVu(data, offset = 0) {
  // __VU and __ITER are read-only globals supplied by the k6 runtime.
  return data.accounts[(__VU + __ITER + offset) % data.accounts.length];
}

export function distinctTransferPair(data) {
  const fromAccountNumber = accountForVu(data);
  const start = data.accounts.indexOf(fromAccountNumber);
  const toAccountNumber = data.accounts[(start + randomInt(1, data.accounts.length - 1)) % data.accounts.length];
  return { fromAccountNumber, toAccountNumber };
}

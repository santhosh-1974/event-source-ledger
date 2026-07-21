// Shared k6 configuration. Override values without editing files, for example:
// k6 run -e BASE_URL=http://localhost:5000 -e VUS=25 -e DURATION=2m deposit.js
export const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';
export const VUS = Number(__ENV.VUS || 10);
export const DURATION = __ENV.DURATION || '1m';
export const ACCOUNT_COUNT = Number(__ENV.ACCOUNT_COUNT || 20);
export const INITIAL_ACCOUNT_BALANCE = __ENV.INITIAL_ACCOUNT_BALANCE || '10000000.00';

// The API currently has no authentication middleware. Keep these headers in one
// place so an authentication header can be added consistently if that changes.
export const COMMON_HEADERS = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

// These apply to every workload. Operation-specific latency thresholds are added
// by each script to make a failing operation immediately visible in k6 output.
export const THRESHOLDS = {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<200'],
  operation_success: ['rate>0.99'],
};

export const API = {
  customers: '/api/v1/customers/create-customer',
  accounts: '/api/v1/accounts',
  deposit: '/api/v1/banking/deposit',
  withdraw: '/api/v1/banking/withdraw',
  transfer: '/api/v1/banking/transfer',
  balance: (accountNumber) => `/api/v1/banking/${encodeURIComponent(accountNumber)}/balance`,
  history: (accountNumber) => `/api/v1/banking/${encodeURIComponent(accountNumber)}/history`,
};

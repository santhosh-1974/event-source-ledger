import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { API, BASE_URL, ACCOUNT_COUNT, DURATION, THRESHOLDS, VUS } from './config.js';
import { accountForVu, checkResponse, createHeaders, createWriteHeaders, distinctTransferPair, provisionFundedAccounts, sleepBetween } from './utils.js';

const operationSuccess = new Rate('operation_success');
const mixedLatency = new Trend('mixed_operation_latency', true);
export const options = { vus: VUS, duration: DURATION, thresholds: { ...THRESHOLDS, mixed_operation_latency: ['p(95)<200', 'p(99)<500'] } };

export function setup() { return provisionFundedAccounts(Math.max(ACCOUNT_COUNT, 2), 10); }

function execute(response, operation, expectedStatus) {
  mixedLatency.add(response.timings.duration, { operation });
  checkResponse(response, operation, expectedStatus, operationSuccess);
}

export default function (data) {
  const choice = Math.random();
  const accountNumber = accountForVu(data);

  // 50% balance, 20% deposit, 15% withdrawal, 15% transfer.
  if (choice < 0.50) {
    execute(http.get(`${BASE_URL}${API.balance(accountNumber)}`, { headers: createHeaders(), tags: { operation: 'balance' } }), 'balance', 200);
  } else if (choice < 0.70) {
    execute(http.post(`${BASE_URL}${API.deposit}`, JSON.stringify({ accountNumber, amount: '10.00' }), { headers: createWriteHeaders(), tags: { operation: 'deposit' } }), 'deposit', 201);
  } else if (choice < 0.85) {
    execute(http.post(`${BASE_URL}${API.withdraw}`, JSON.stringify({ accountNumber, amount: '10.00' }), { headers: createWriteHeaders(), tags: { operation: 'withdraw' } }), 'withdraw', 201);
  } else {
    const pair = distinctTransferPair(data);
    execute(http.post(`${BASE_URL}${API.transfer}`, JSON.stringify({ ...pair, amount: '10.00', description: 'k6 mixed workload transfer' }), { headers: createWriteHeaders(), tags: { operation: 'transfer' } }), 'transfer', 201);
  }
  sleepBetween(0.05, 0.3);
}

import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { API, BASE_URL, ACCOUNT_COUNT, DURATION, THRESHOLDS, VUS } from './config.js';
import { accountForVu, checkResponse, createWriteHeaders, provisionFundedAccounts, sleepBetween } from './utils.js';

const operationSuccess = new Rate('operation_success');
const depositLatency = new Trend('deposit_latency', true);

export const options = {
  vus: VUS,
  duration: DURATION,
  thresholds: { ...THRESHOLDS, deposit_latency: ['p(95)<200', 'p(99)<500'] },
};

export function setup() { return provisionFundedAccounts(ACCOUNT_COUNT); }

export default function (data) {
  const response = http.post(`${BASE_URL}${API.deposit}`, JSON.stringify({
    accountNumber: accountForVu(data),
    amount: '10.00',
  }), { headers: createWriteHeaders(), tags: { operation: 'deposit' } });

  depositLatency.add(response.timings.duration);
  checkResponse(response, 'deposit', 201, operationSuccess);
  sleepBetween();
}

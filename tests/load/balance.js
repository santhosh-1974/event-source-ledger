import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { API, BASE_URL, ACCOUNT_COUNT, DURATION, THRESHOLDS, VUS } from './config.js';
import { accountForVu, checkResponse, createHeaders, provisionFundedAccounts, sleepBetween } from './utils.js';

const operationSuccess = new Rate('operation_success');
const balanceLatency = new Trend('balance_latency', true);
// Read-heavy default: increase VUS with -e VUS=100 for higher concurrency.
export const options = { vus: VUS, duration: DURATION, thresholds: { ...THRESHOLDS, balance_latency: ['p(95)<200', 'p(99)<500'] } };

export function setup() { return provisionFundedAccounts(ACCOUNT_COUNT); }

export default function (data) {
  const response = http.get(`${BASE_URL}${API.balance(accountForVu(data))}`, { headers: createHeaders(), tags: { operation: 'balance' } });
  balanceLatency.add(response.timings.duration);
  checkResponse(response, 'balance', 200, operationSuccess);
  sleepBetween(0.02, 0.15);
}

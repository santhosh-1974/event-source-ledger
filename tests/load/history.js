import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { API, BASE_URL, ACCOUNT_COUNT, DURATION, THRESHOLDS, VUS } from './config.js';
import { accountForVu, checkResponse, createHeaders, pick, provisionFundedAccounts, randomInt, sleepBetween } from './utils.js';

const operationSuccess = new Rate('operation_success');
const historyLatency = new Trend('history_latency', true);
const PAGE_SIZES = [1, 5, 10, 20, 50, 100]; // All are within the API's 1..100 validation range.
export const options = { vus: VUS, duration: DURATION, thresholds: { ...THRESHOLDS, history_latency: ['p(95)<200', 'p(99)<500'] } };

export function setup() { return provisionFundedAccounts(ACCOUNT_COUNT, 25); }

export default function (data) {
  const limit = pick(PAGE_SIZES);
  const page = randomInt(1, 5);
  const sort = Math.random() < 0.5 ? 'asc' : 'desc';
  const url = `${BASE_URL}${API.history(accountForVu(data))}?page=${page}&limit=${limit}&sort=${sort}`;
  const response = http.get(url, { headers: createHeaders(), tags: { operation: 'history' } });
  historyLatency.add(response.timings.duration);
  checkResponse(response, 'history', 200, operationSuccess);
  sleepBetween(0.05, 0.25);
}

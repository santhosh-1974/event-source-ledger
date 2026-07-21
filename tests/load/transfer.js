import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { API, BASE_URL, ACCOUNT_COUNT, DURATION, THRESHOLDS, VUS } from './config.js';
import { checkResponse, createWriteHeaders, distinctTransferPair, provisionFundedAccounts, sleepBetween } from './utils.js';

const operationSuccess = new Rate('operation_success');
const transferLatency = new Trend('transfer_latency', true);
export const options = { vus: VUS, duration: DURATION, thresholds: { ...THRESHOLDS, transfer_latency: ['p(95)<200', 'p(99)<500'] } };

export function setup() { return provisionFundedAccounts(Math.max(ACCOUNT_COUNT, 2)); }

export default function (data) {
  const pair = distinctTransferPair(data); // Always selects two different valid accounts.
  const response = http.post(`${BASE_URL}${API.transfer}`, JSON.stringify({
    fromAccountNumber: pair.fromAccountNumber, toAccountNumber: pair.toAccountNumber,
    amount: '10.00', description: 'k6 load-test transfer',
  }), { headers: createWriteHeaders(), tags: { operation: 'transfer' } });
  transferLatency.add(response.timings.duration);
  checkResponse(response, 'transfer', 201, operationSuccess);
  sleepBetween();
}

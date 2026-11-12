import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api-client';

describe('customer profile API', () => {
  afterEach(() => {
    apiClient.setAuthToken(null);
    vi.unstubAllGlobals();
  });

  it('fetches the signed-in customer profile from the Customer Service route', async () => {
    const customer = {
      id: 'customer-1',
      name: 'Alice',
      email: 'alice@example.com',
      phone: '5551234567',
      createdAt: '2026-11-13T00:00:00.000Z',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: customer }),
    });
    vi.stubGlobal('fetch', fetchMock);
    apiClient.setAuthToken('test-token');

    await expect(apiClient.getCustomerProfile()).resolves.toEqual({ customer });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/v1\/customers\/me$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      })
    );
  });
});

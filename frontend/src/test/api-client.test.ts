import { describe, it, expect } from 'vitest';
import { ApiError } from '../lib/api-client';

describe('ApiError', () => {
  it('should create error with message and status', () => {
    const error = new ApiError('Not found', 404);
    expect(error.message).toBe('Not found');
    expect(error.status).toBe(404);
    expect(error.name).toBe('ApiError');
  });

  it('should accept optional details', () => {
    const details = { field: 'email' };
    const error = new ApiError('Validation failed', 400, details);
    expect(error.details).toEqual(details);
  });
});

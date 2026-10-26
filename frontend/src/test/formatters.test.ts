import { describe, it, expect } from 'vitest';
import { formatCurrency, formatAccountNumber, formatDate } from '../lib/formatters';

describe('Formatters', () => {
  describe('formatCurrency', () => {
    it('should format string amounts as Indian Rupees', () => {
      expect(formatCurrency('1000')).toBe('₹1,000.00');
      expect(formatCurrency('1000.50')).toBe('₹1,000.50');
      expect(formatCurrency('0')).toBe('₹0.00');
    });

    it('should format number amounts as Indian Rupees', () => {
      expect(formatCurrency(1000)).toBe('₹1,000.00');
      expect(formatCurrency(1000.5)).toBe('₹1,000.50');
    });
  });

  describe('formatAccountNumber', () => {
    it('should format account numbers with hyphens', () => {
      expect(formatAccountNumber('1000000001')).toBe('1000-0000-001');
      expect(formatAccountNumber('1234')).toBe('1234');
      expect(formatAccountNumber('12345678')).toBe('1234-5678');
    });
  });

  describe('formatDate', () => {
    it('should format ISO date strings', () => {
      const date = '2024-01-15T10:30:00.000Z';
      const formatted = formatDate(date);
      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });
  });
});

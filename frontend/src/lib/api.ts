import { apiClient } from './api-client';
import type {
  CreateAccountInput,
  DepositInput,
  PaginationParams,
  TransferInput,
  WithdrawInput,
} from './types/api';

export {
  ApiError,
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServerError,
  ValidationError,
  apiClient,
} from './api-client';

export const setAuthToken = (token: string | null) => {
  apiClient.setAuthToken(token);
};

export const api = {
  setAuthToken,

  auth: {
    login: ({ email, password }: { email: string; password: string }) =>
      apiClient.login({ email, password }),
    register: ({
      fullName,
      email,
      phone,
      password,
    }: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
    }) =>
      apiClient.register({
        name: fullName,
        email,
        phone,
        password,
      }),
  },

  customers: {
    getAll: () => apiClient.getCustomers(),
    get: (id: string) => apiClient.getCustomer(id),
  },

  accounts: {
    getAll: () => apiClient.getAccounts(),
    get: (id: string) => apiClient.getAccount(id),
    create: (data: CreateAccountInput) => apiClient.createAccount(data),
  },

  banking: {
    deposit: (data: DepositInput, idempotencyKey: string) =>
      apiClient.deposit(data, idempotencyKey),
    withdraw: (data: WithdrawInput, idempotencyKey: string) =>
      apiClient.withdraw(data, idempotencyKey),
    transfer: (data: TransferInput, idempotencyKey: string) =>
      apiClient.transfer(data, idempotencyKey),
    getBalance: (accountNumber: string, at?: string) =>
      apiClient.getBalance(accountNumber, at),
    getHistory: (accountNumber: string, params: PaginationParams = {}) =>
      apiClient.getTransactionHistory(accountNumber, params),
  },

  transactions: {
    get: (id: string) => apiClient.getTransaction(id),
  },

  health: {
    check: () => apiClient.healthCheck(),
  },
};

export type ApiErrorTypes = import('./api-client').ApiError;

// Customer Types
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
}

export interface CreateCustomerInput {
  name: string;
  email: string;
  phone: string;
}

// Account Types
export type AccountType = "SAVINGS" | "CURRENT";
export type AccountStatus = "ACTIVE" | "BLOCKED" | "CLOSED";

export interface BankAccount {
  id: string;
  accountNumber: string;
  customerId: string;
  accountType: AccountType;
  status: AccountStatus;
  createdAt: string;
}

export interface CreateAccountInput {
  customerId: string;
  accountNumber: string;
  accountType: AccountType;
}

export interface UpdateAccountStatusInput {
  status: AccountStatus;
}

// Banking Types
export interface DepositInput {
  accountNumber: string;
  amount: string;
}

export interface WithdrawInput {
  accountNumber: string;
  amount: string;
}

export interface TransferInput {
  fromAccountNumber: string;
  toAccountNumber: string;
  amount: string;
  description?: string;
}

export interface DepositResult {
  transactionId: string;
  reference: string;
}

export interface WithdrawResult {
  transactionId: string;
  reference: string;
}

export interface TransferResult {
  transactionId: string;
  reference: string;
}

export interface AccountBalanceResult {
  accountNumber: string;
  balance: string;
  asOf?: string;
}

export interface TransactionHistoryItem {
  transactionId: string;
  reference: string;
  entryType: "DEBIT" | "CREDIT";
  amount: string;
  description: string | null;
  createdAt: string;
}

export interface TransactionHistoryResult {
  transactions: TransactionHistoryItem[];
  pagination: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
}

// Transaction Types
export interface TransactionDetailEntry {
  id: string;
  transactionId: string;
  ledgerAccountId: string;
  bankAccountId: string | null;
  ledgerAccountName: string;
  entryType: "DEBIT" | "CREDIT";
  amount: string;
  createdAt: string;
}

export interface TransactionDetails {
  transactionId: string;
  reference: string;
  type: string | null;
  createdAt: string;
  entries: TransactionDetailEntry[];
  debitEntries: TransactionDetailEntry[];
  creditEntries: TransactionDetailEntry[];
}

// API Response Types
export interface ApiResponse<T> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message?: string;
  details?: any;
}

export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

// Pagination Types
export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: "asc" | "desc";
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

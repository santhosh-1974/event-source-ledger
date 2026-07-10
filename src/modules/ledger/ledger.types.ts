export type LedgerType =
  | "ASSET"
  | "LIABILITY"
  | "EQUITY"
  | "INCOME"
  | "EXPENSE";

export type LedgerCategory =
  | "SYSTEM"
  | "CUSTOMER";

export type LedgerEntryType =
  | "DEBIT"
  | "CREDIT";

export interface LedgerAccount{
    id:string
    bankAccountId:string|null
    name: string
    ledgerType:LedgerType
    category:LedgerCategory
    createdAt: Date
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  ledgerAccountId: string;
  entryType: LedgerEntryType;
  amount: string;
  createdAt: Date;
}
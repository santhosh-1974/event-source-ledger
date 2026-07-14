export type AccountType = "SAVINGS" | "CURRENT";
export type AccountStatus = "ACTIVE" | "BLOCKED" | "CLOSED";

export interface BankAccount {
    id: string;
    accountNumber: string;
    customerId: string;
    accountType: AccountType;
    status: AccountStatus;
    createdAt: Date;
}
export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type AccountCategory = "SYSTEM" | "CUSTOMER";


export interface BankAccount {
    id: string;
    accountNumber: string;
    customerId: string;
    accountType: string;
    status: string;
    createdAt: Date;
}
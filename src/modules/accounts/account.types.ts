export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export type AccountCategory = "SYSTEM" | "CUSTOMER";

export interface Account {
    id: string;
    name: string;
    type: AccountType;
    category: AccountCategory;
    createdAt: Date;
}
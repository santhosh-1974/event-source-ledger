export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE";
export interface Account{
    id:string,
    name:string,
    type:AccountType,
    createdAt:Date
}
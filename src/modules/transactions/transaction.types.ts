export interface transaction{
    id:string,
    reference:string,
    description:string|null,
    createdAt:Date
}

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

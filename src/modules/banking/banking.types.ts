
export interface depositResult {
    transactionId: string;
    reference: string;
}

export interface withdrawResult {
    transactionId: string;
    reference: string;
}

export interface transferResult {
    transactionId: string;
    reference: string;
}

export interface accountBalanceResult {
    accountNumber: string;
    balance: string;
}

export interface transactionHistoryItem {
    transactionId: string;
    reference: string;
    entryType: "DEBIT" | "CREDIT";
    amount: string;
    description: string | null;
    createdAt: string;
}

export interface transactionHistoryResult {
    transactions: transactionHistoryItem[];
    pagination: {
        page: number;
        limit: number;
        totalRecords: number;
        totalPages: number;
    };
}
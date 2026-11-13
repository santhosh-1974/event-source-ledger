import { AccountStatement } from "./report.repository";

function csvCell(value: string, preventFormula = false): string {
  const safeValue =
    preventFormula && /^[\s]*[=+\-@\t\r]/.test(value)
      ? `'${value}`
      : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

export function statementToCsv(statement: AccountStatement): string {
  const rows = [
    [
      "account_number",
      "period_from",
      "period_to",
      "snapshot_at",
      "opening_balance",
      "total_debits",
      "total_credits",
      "closing_balance",
    ],
    [
      statement.accountNumberMasked,
      statement.from,
      statement.to,
      statement.snapshotAt,
      statement.openingBalance,
      statement.totalDebits,
      statement.totalCredits,
      statement.closingBalance,
    ],
    [],
    [
      "created_at",
      "reference",
      "description",
      "debit",
      "credit",
      "running_balance",
    ],
    ...statement.entries.map((entry) => [
      entry.createdAt,
      entry.reference,
      entry.description ?? "",
      entry.entryType === "DEBIT" ? entry.amount : "",
      entry.entryType === "CREDIT" ? entry.amount : "",
      entry.runningBalance,
    ]),
  ];

  return rows
    .map((row) =>
      row
        .map((value, index) =>
          csvCell(value, [1, 2].includes(index) && row.length === 6)
        )
        .join(",")
    )
    .join("\r\n");
}

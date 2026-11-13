import { Request, Response } from "express";

import { NotFoundError } from "../../errors/errors";
import { getAccountStatement } from "./report.repository";
import { statementToCsv } from "./report.service";
import {
  statementAccountNumberSchema,
  statementQuerySchema,
} from "./report.schema";

export async function accountStatementHandler(
  req: Request,
  res: Response
): Promise<void> {
  if (!req.auth?.customerId) {
    throw new NotFoundError("Authenticated customer not found.");
  }
  const query = statementQuerySchema.parse(req.query);
  const statement = await getAccountStatement(
    req.auth.customerId,
    statementAccountNumberSchema.parse(req.params.accountNumber),
    query.from,
    query.to
  );
  if (query.format === "csv") {
    const filename = `statement-${statement.accountNumberMasked.slice(-4)}-${query.from}-${query.to}.csv`;
    res
      .status(200)
      .type("text/csv")
      .attachment(filename)
      .send(statementToCsv(statement));
    return;
  }
  res.status(200).json({ success: true, data: statement });
}

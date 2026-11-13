import { z } from "zod";

const utcDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must use YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Invalid calendar date");

export const statementQuerySchema = z
  .object({
    from: utcDateSchema,
    to: utcDateSchema,
    format: z.enum(["json", "csv"]).default("json"),
  })
  .strict();

export const statementAccountNumberSchema = z.string().trim().min(1).max(20);

export type StatementQuery = z.infer<typeof statementQuerySchema>;

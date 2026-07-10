import {z} from "zod"

export const createAccountSchmea=z.object({
    name:z.string().min(1,"Account name is required").max(255,"Account name cannot exceed 255 characters"),
    type:z.enum(["ASSET","LIABILITY","EQUITY","INCOME","EXPENSE",])
})
export type createAccountInput=z.infer<typeof createAccountSchmea>
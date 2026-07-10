import { z} from "zod"
export const createTransactionSchema=z.object({
    refernce:z.string().min(1).max(30),
    description:z.string()
})
export type createTransactionType=z.infer<typeof createTransactionSchema>
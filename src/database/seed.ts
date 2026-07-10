import { logger } from "../config/logger";
import { query } from "./database";

async function seed():Promise<void>{
    try{
        logger.info("Starting database seed...");
        await query(
        `
            insert into ledger_accounts(name,ledger_type,category)
            values ('cash','ASSET','SYSTEM'),
            ('bank revenue','INCOME','SYSTEM'),
            ('ATM Fees','INCOME','SYSTEM'),
            ('Interest Expense','EXPENSE','SYSTEM')
            on conflict do nothing
        `
        );
        logger.info("Database seeded successfully")
    }catch(err){
        logger.error(err,"Failed to seed database");
        process.exit(1);
    }
}
seed();
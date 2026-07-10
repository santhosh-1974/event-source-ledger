import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder):Promise<void>{
    pgm.createExtension("pgcrypto",{
        ifNotExists:true
    })
    pgm.createType("account_type",["ASSET","LIABILITY","EQUITY","INCOME","EXPENSE"])
    pgm.createTable("accounts",{
        id:{
            type:"uuid",
            primaryKey:true,
           default:pgm.func("gen_random_uuid()")
        },
        name:{
            type:"varchar(255)",
            notNull:true,
        },
        type:{
            type:"account_type",
            notNull:true
        },
        created_at:{
            type:"timestamptz",
            notNull:true
        }
    })
}
export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.dropTable("accoounts")
    pgm.dropType("account_type")
    pgm.dropExtension("pgcrypto",{
        ifExists:true
    })
}

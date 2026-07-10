import { createTransactionType } from "./transaction.schema";
import { transaction } from "./transaction.types";
import { query } from "../../database/database";
import { PoolClient } from "pg";

interface transactionRow{
    id:string,
    reference:string,
    description:string|null,
    created_at:Date
}
function mapTransaction(row:transactionRow):transaction{
    return {
        id:row.id,
        reference:row.reference,
        description:row.description,
        createdAt:row.created_at
    }
}

export async function create(client:PoolClient,data:createTransactionType):Promise<transaction>{
    const sql=
    `
        insert into transactions(reference,type) 
        values ($1,$2)
        returning id,reference,description,created_at
    `
    const result=await client.query<transactionRow>(sql,[data.refernce,data.description])
    return mapTransaction(result.rows[0]);
}

export async function findByid(id:string):Promise<transaction|null>{
    const sql=`
        select * from transactions 
        where id=$1
    `
    const result=await query<transactionRow>(sql,[id]);
    if(result.rowCount===0)return null;
    return mapTransaction(result.rows[0]);

}
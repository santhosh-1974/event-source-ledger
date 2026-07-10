import type {Account} from './account.types';
import { query } from '../../config/database';

export async function create(account:Account):Promise<Account>{
    const sql=`
        insert into accounts(id,name,type,created_at)
        values ($1,$2,$3,$4)
        returning id,name,type,created_at as "createdAt"
    `;
    const result=await query<Account>(sql,[account.id,account.name,account.type,account.createdAt]);
    return result.rows[0];
}
export async function findById(id:string):Promise<Account>{
    const sql=`
        select id,name,type,created_at as "createdAt" from accounts
        where id=$1
    `
    const result=await query<Account>(sql,[id]);
    return result.rows[0]??null;
}

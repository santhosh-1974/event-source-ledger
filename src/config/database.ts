import {Pool,PoolClient,QueryResult,QueryResultRow} from "pg"
import { env } from "./env"
import {logger} from './logger';

export const pool=new Pool({

    host:env.DATABASE_HOST,
    port:env.DATABASE_PORT,
    database:env.DATABASE_NAME,
    user:env.DATABASE_USER,
    password:env.DATABASE_PASSWORD,

    max:10,
    idleTimeoutMillis:30_000,
    connectionTimeoutMillis:5000
})

pool.on("error", (error) => {
  logger.error(error, "Unexpected PostgreSQL pool error");
});

export async function connectDB():Promise<void>{
    let client:PoolClient|undefined;
    try{
        client=await pool.connect(); 
        await client.query("select 1");
        logger.info("Connected to PostgreSQL")
    }catch(err){
        logger.fatal(err," Failed to connect PostgreSQL")
        process.exit(1);
    }finally{
        client?.release();
    }
}
export async function disconnectDB():Promise<void>{
    await pool.end();
    logger.info("PostgreSQL connection pool closed");
}
 
export async function query<T extends QueryResultRow>(text:string,params:unknown[]=[]) : Promise<QueryResult<T>>{
    return pool.query<T>(text,params)
}
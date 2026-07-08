import app from "./app"
import { connectDB, disconnectDB } from "./config/database"
import { env } from "./config/env";
import { logger } from "./config/logger";

async function bootstrap(){
    try{
        await connectDB();
        const server=app.listen(env.PORT,()=>logger.info(`Server running on http://localhost:${env.PORT}`))

        async function shutdown(signal:string){
            logger.info(`${signal} received.Shutting down`)
            server.close(async()=>{
                await disconnectDB();
                logger.info("HTTP server closed")
            })
            process.exit(0)
        }

        process.on("SIGINT",()=>shutdown("SIGINT"))
        process.on("SIGTERM",()=>shutdown("SIGTERM"))
    }catch(err){
        logger.fatal(err,"Application failed to start")
        process.exit(1)
    }
}
bootstrap();
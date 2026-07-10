import pino from "pino"
import {env} from "./env";
console.log({
  NODE_ENV: env.NODE_ENV,
  LOG_LEVEL: env.LOG_LEVEL,
});
export const logger=pino({
    level:env.LOG_LEVEL,
    transport:(env.NODE_ENV==="production") ? undefined : {
        target:"pino-pretty",
        options:{
            colorize:true,
            translateTime:"SYS:standard",
            ignore:"pid,hostname"
        }
    }
})
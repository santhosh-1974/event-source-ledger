import {Request,Response,NextFunction} from "express"
import { logger } from "../config/logger"

export function errorHandler(err:Error,req:Request,res:Response,next:NextFunction):void{
    logger.error(err)
    res.status(500).json({
        success:false,
        message:"Internal sever error"
    })
}
import {Request,Response,NextFunction} from "express"

export function notFound(req:Request,res:Response,next:NextFunction):void{
    res.status(404).json({
        success:false,
        message:"Route not found"
    })
}
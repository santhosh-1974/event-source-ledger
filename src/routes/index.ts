import {Router} from "express"
import {pool} from "../config/database"

const router=Router();
router.route('/health').get(async(_req,res)=>{
    try{
        await pool.query("select 1");
        res.status(200).json({
            success:"UP",
            message:"UP",
            timestamp: new Date().toISOString(),
        })
    }catch(err){
        res.status(500).json({
            success:"DOWN",
            message:"DOWN",
            timestamp: new Date().toISOString(),
        })
    }
})

export default router;
import express, { type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { config } from './config.js';
export class HttpError extends Error { constructor(public status:number, message:string){ super(message); } }
export const asyncRoute = (fn:(req:Request,res:Response)=>Promise<unknown>):RequestHandler => (req,res,next)=>{Promise.resolve(fn(req,res)).catch(next);};
export const auth:RequestHandler = (req,res,next)=>{
  try { const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]; if(!token) throw new Error();
    const data=jwt.verify(token,config.JWT_ACCESS_SECRET,{algorithms:['HS256'],issuer:'railflow',audience:'railflow-api'});
    if(typeof data==='string' || !data.sub || data.kind!=='access') throw new Error(); res.locals.userId=data.sub; next();
  } catch { next(new HttpError(401,'Valid access token required')); }
};
export function appBase(){const app=express(); app.use(helmet(),cors({origin:config.CORS_ORIGIN}),rateLimit({windowMs:60000,limit:120})); app.get('/health',(_req,res)=>res.json({status:'ok'})); return app;}
export function errors(app:express.Express){app.use((_req,res)=>res.status(404).json({error:'Not found'})); app.use((err:unknown,_req:Request,res:Response,_next:NextFunction)=>{
 if(err instanceof ZodError){res.status(400).json({error:'Invalid request',details:err.flatten()});return;}
 if(err instanceof HttpError){res.status(err.status).json({error:err.message});return;}
 if(err instanceof Prisma.PrismaClientKnownRequestError && err.code==='P2002'){res.status(409).json({error:'Duplicate request or allocation conflict'});return;}
 if(err instanceof SyntaxError){res.status(400).json({error:'Malformed JSON'});return;}
 console.error(err);res.status(500).json({error:'Internal server error'});
});}
export function listen(app:express.Express,port:number){const server=app.listen(port,()=>console.log(`RailFlow listening on ${port}`)); for(const sig of ['SIGINT','SIGTERM']) process.once(sig,()=>server.close(()=>process.exit(0)));}

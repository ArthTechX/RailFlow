import { randomUUID } from 'node:crypto';
import { redis, db } from './infra.js';
import { HttpError } from './http.js';
import type { Prisma } from '@prisma/client';
export async function journeyTransaction<T>(journeyId:string, fn:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
 const key=`lock:journey:${journeyId}`, token=randomUUID();
 if(await redis.set(key,token,'PX',15000,'NX')!=='OK') throw new HttpError(409,'Journey is busy; retry with the same Idempotency-Key');
 try{return await db.$transaction(async tx=>{
   // Database lock remains authoritative even if the Redis lease expires.
   const rows=await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "Journey" WHERE id=${journeyId} FOR UPDATE`;
   if(!rows.length) throw new HttpError(404,'Journey not found');
   return fn(tx);
 },{maxWait:10000,timeout:12000});}
 finally{await redis.eval("if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('del',KEYS[1]) else return 0 end",1,key,token).catch(console.error);}
}

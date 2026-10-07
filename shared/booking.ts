import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './infra.js';
import { journeyTransaction } from './locking.js';
import { HttpError } from './http.js';
import { config } from './config.js';
import type { Prisma } from '@prisma/client';
export const bookingInput=z.object({journeyId:z.string().min(1),passengers:z.array(z.object({name:z.string().trim().min(2).max(100),age:z.number().int().min(1).max(120)})).min(1).max(6)});
export const bookingInclude={passengers:{include:{allocation:{include:{seat:{include:{coach:true}}}}}},payment:true,journey:{include:{train:true,source:true,destination:true}}} satisfies Prisma.BookingInclude;
export function allocationStatuses(requested:number,available:number){return Array.from({length:requested},(_,i)=>i<available?'CONFIRMED' as const:'WAITLISTED' as const);}
export async function createBooking(userId:string,key:string,input:z.infer<typeof bookingInput>){
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 return journeyTransaction(input.journeyId,async tx=>{
  const prior=await tx.booking.findUnique({where:{userId_idempotencyKey:{userId,idempotencyKey:key}},include:bookingInclude});
  if(prior){if(prior.requestHash!==hash) throw new HttpError(409,'Idempotency-Key was used with another request');return prior;}
  const journey=await tx.journey.findUniqueOrThrow({where:{id:input.journeyId}});
  if(journey.departureAt<=new Date())throw new HttpError(409,'Journey has departed');
  const seats=await tx.journeySeat.findMany({where:{journeyId:input.journeyId,passengerId:null},orderBy:{id:'asc'},take:input.passengers.length});
  if(!seats.length) throw new HttpError(409,'No seats available');
  const statuses=allocationStatuses(input.passengers.length,seats.length);
  const booking=await tx.booking.create({data:{userId,journeyId:input.journeyId,idempotencyKey:key,requestHash:hash,amountPaise:seats.length*journey.farePaise,expiresAt:new Date(Date.now()+config.HOLD_MINUTES*60000)}});
  for(const [i,p] of input.passengers.entries()){
   const passenger=await tx.passenger.create({data:{...p,bookingId:booking.id,status:statuses[i]!}});
   if(seats[i]){const result=await tx.journeySeat.updateMany({where:{id:seats[i]!.id,passengerId:null},data:{passengerId:passenger.id}});if(result.count!==1)throw new HttpError(409,'Seat allocation conflict');}
  }
  return tx.booking.findUniqueOrThrow({where:{id:booking.id},include:bookingInclude});
 });
}
export async function releaseSeats(tx:Prisma.TransactionClient,bookingId:string){await tx.journeySeat.updateMany({where:{passenger:{bookingId}},data:{passengerId:null}});}
export async function ownedBooking(id:string,userId:string){const b=await db.booking.findFirst({where:{id,userId},include:bookingInclude});if(!b)throw new HttpError(404,'Booking not found');return b;}
export async function cancelBooking(id:string,userId:string){const b=await ownedBooking(id,userId);return journeyTransaction(b.journeyId,async tx=>{
 const current=await tx.booking.findUniqueOrThrow({where:{id},include:{payment:true,journey:true}});
 if(['CANCELLED','REFUNDED','PAYMENT_FAILED'].includes(current.status))return current;
 if(current.journey.departureAt<=new Date())throw new HttpError(409,'Cannot cancel a departed journey');
 await releaseSeats(tx,id);await tx.booking.update({where:{id},data:{status:'CANCELLED'}});
 if(current.payment?.status==='SUCCEEDED')await tx.outboxEvent.create({data:{type:'refund',payload:{paymentId:current.payment.id}}});
 return tx.booking.findUniqueOrThrow({where:{id},include:bookingInclude});
});}

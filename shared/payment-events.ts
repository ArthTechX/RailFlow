import { db } from './infra.js';
import { journeyTransaction } from './locking.js';
import { releaseSeats } from './booking.js';
import { HttpError } from './http.js';
export async function applyPaymentEvent(paymentId:string,eventId:string,success:boolean){const p=await db.payment.findUnique({where:{id:paymentId},include:{booking:true}});if(!p)throw new HttpError(404,'Payment not found');return journeyTransaction(p.booking.journeyId,async tx=>{
 if(await tx.webhookEvent.findUnique({where:{id:eventId}}))return {duplicate:true};
 const payment=await tx.payment.findUniqueOrThrow({where:{id:paymentId},include:{booking:true}});const b=payment.booking;
 await tx.webhookEvent.create({data:{id:eventId}});
 if(payment.status==='REFUNDED'||payment.status==='SUCCEEDED')return {status:b.status};
 if(!success){if(b.status==='PENDING'){await releaseSeats(tx,b.id);await tx.booking.update({where:{id:b.id},data:{status:'PAYMENT_FAILED'}});}await tx.payment.update({where:{id:paymentId},data:{status:'FAILED'}});return {status:b.status==='PENDING'?'PAYMENT_FAILED':b.status};}
 await tx.payment.update({where:{id:paymentId},data:{status:'SUCCEEDED'}});
 if(b.status!=='PENDING'||b.expiresAt<=new Date()){
  await releaseSeats(tx,b.id);if(b.status==='PENDING')await tx.booking.update({where:{id:b.id},data:{status:'CANCELLED'}});
  await tx.outboxEvent.create({data:{type:'refund',payload:{paymentId}}});return {status:b.status==='PENDING'?'CANCELLED':b.status};
 }
 await tx.booking.update({where:{id:b.id},data:{status:'CONFIRMED'}});
 await tx.outboxEvent.create({data:{type:'confirmation',payload:{bookingId:b.id}}});return {status:'CONFIRMED'};
});}

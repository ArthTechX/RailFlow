import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { db, redis } from '../../../shared/infra.js';
import { config } from '../../../shared/config.js';
import { provider } from '../../../shared/payments.js';
import { journeyTransaction } from '../../../shared/locking.js';
import { releaseSeats } from '../../../shared/booking.js';
import { applyPaymentEvent } from '../../../shared/payment-events.js';
const queue=new Queue('railflow-events',{connection:redis});
const mail=config.SMTP_HOST?nodemailer.createTransport({host:config.SMTP_HOST,port:config.SMTP_PORT,secure:false}):null;
const worker=new Worker('railflow-events',async job=>{
 if(job.name==='confirmation'){
  const b=await db.booking.findUniqueOrThrow({where:{id:job.data.bookingId},include:{user:true,journey:{include:{train:true}},passengers:true}});
  if(b.status!=='CONFIRMED')return;
  const text=`Booking ${b.id} confirmed on ${b.journey.train.name}.\n${b.passengers.map(p=>`${p.name}: ${p.status}`).join('\n')}`;
  if(!mail)throw new Error('SMTP_HOST is required for confirmation delivery');
  await mail.sendMail({from:config.SMTP_FROM,to:b.user.email,subject:`RailFlow booking ${b.id}`,text,messageId:`<${job.id}@railflow.local>`});
 } else if(job.name==='refund'){
  const p=await db.payment.findUniqueOrThrow({where:{id:job.data.paymentId},include:{booking:true}});if(p.status==='REFUNDED')return;
  if(p.status!=='SUCCEEDED'||!p.providerId)throw new Error('Payment not refundable');
  await provider(p.provider).refundPayment(p.providerId,p.id);
  await journeyTransaction(p.booking.journeyId,async tx=>{await tx.payment.update({where:{id:p.id},data:{status:'REFUNDED'}});await tx.booking.update({where:{id:p.bookingId},data:{status:'REFUNDED'}});});
 }
},{connection:redis,concurrency:4});worker.on('failed',(job,err)=>console.error('Job failed',job?.id,err.message));
let running=false;
let paymentCursor:string|undefined;
let lastReconciled=0;
async function tick(){if(running)return;running=true;try{
 const events=await db.outboxEvent.findMany({where:{publishedAt:null},orderBy:{createdAt:'asc'},take:100});
 for(const e of events){await queue.add(e.type,e.payload,{jobId:e.id,attempts:10,backoff:{type:'exponential',delay:2000},removeOnComplete:false});await db.outboxEvent.update({where:{id:e.id},data:{publishedAt:new Date()}});}
 const expired=await db.booking.findMany({where:{status:'PENDING',expiresAt:{lt:new Date()}},take:100});
 for(const b of expired)await journeyTransaction(b.journeyId,async tx=>{const fresh=await tx.booking.findUniqueOrThrow({where:{id:b.id}});if(fresh.status==='PENDING'&&fresh.expiresAt<=new Date()){await releaseSeats(tx,b.id);await tx.booking.update({where:{id:b.id},data:{status:'CANCELLED'}});}}).catch(console.error);
 if(Date.now()-lastReconciled>=15000){
  lastReconciled=Date.now();
  const payments=await db.payment.findMany({where:{provider:{not:'mock'},status:{in:['CREATED','FAILED']},providerId:{not:null}},orderBy:{id:'asc'},take:10,...(paymentCursor?{cursor:{id:paymentCursor},skip:1}:{})});
  paymentCursor=payments.length===10?payments.at(-1)!.id:undefined;
  const results=await Promise.allSettled(payments.map(async p=>{if(await provider(p.provider).verifyPayment(p.providerId!,p.amountPaise))await applyPaymentEvent(p.id,`reconcile:${p.id}`,true);}));
  for(const result of results)if(result.status==='rejected')console.error('Payment reconciliation failed',result.reason);
 }
 }catch(err){console.error('Outbox/cleanup error',err);}finally{running=false;}}
const timer=setInterval(()=>void tick(),2000);void tick();
for(const sig of ['SIGTERM','SIGINT'])process.once(sig,async()=>{clearInterval(timer);await worker.close();await queue.close();await db.$disconnect();await redis.quit();process.exit(0);});
console.log('RailFlow notification worker running');

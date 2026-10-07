import express from 'express';
import { z } from 'zod';
import { appBase, auth, asyncRoute, errors, HttpError } from '../../../shared/http.js';
import { ownedBooking } from '../../../shared/booking.js';
import { db } from '../../../shared/infra.js';
import { config } from '../../../shared/config.js';
import { provider, validSignature } from '../../../shared/payments.js';
import { applyPaymentEvent } from '../../../shared/payment-events.js';
export function paymentApp(){const app=appBase();
 app.post('/payments/webhook',express.raw({type:'application/json',limit:'32kb'}),asyncRoute(async(req,res)=>{
  if(!Buffer.isBuffer(req.body)||!validSignature(req.body,req.header('X-RailFlow-Signature')||'',config.PAYMENT_WEBHOOK_SECRET))throw new HttpError(401,'Invalid webhook signature');
  const event=z.object({id:z.string().min(8).max(128),paymentId:z.string(),success:z.boolean()}).parse(JSON.parse(req.body.toString()));
  const p=await db.payment.findUnique({where:{id:event.paymentId}});if(!p)throw new HttpError(404,'Payment not found');
  // This signed endpoint is for the mock adapter or a trusted provider-event bridge.
  // Real success always requires a server-to-server provider check.
  const success=p.provider==='mock'?event.success:await provider(p.provider).verifyPayment(p.providerId!,p.amountPaise);
  if(p.provider!=='mock'&&!success){res.status(202).json({status:'unverified'});return;}
  res.json(await applyPaymentEvent(p.id,`${p.provider}:${event.id}`,success));
 }));
 app.use(express.json({limit:'16kb'}),auth);
 app.post('/payments/create',asyncRoute(async(req,res)=>{const {bookingId}=z.object({bookingId:z.string()}).parse(req.body);const b=await ownedBooking(bookingId,res.locals.userId);if(b.status!=='PENDING'||b.expiresAt<=new Date())throw new HttpError(409,'Booking is not payable');
 const p=await db.payment.upsert({where:{bookingId},create:{bookingId,provider:config.PAYMENT_PROVIDER,amountPaise:b.amountPaise},update:{}});
 if(p.providerId){res.json(p);return;}
 // Serialize external creation across service replicas. Stripe also uses provider idempotency.
 const result=await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "Payment" WHERE id=${p.id} FOR UPDATE`;const current=await tx.payment.findUniqueOrThrow({where:{id:p.id}});if(current.providerId)return current;const external=await provider(p.provider).createPayment(p.id,p.amountPaise);return tx.payment.update({where:{id:p.id},data:{providerId:external.id,checkoutUrl:external.checkoutUrl}});},{timeout:15000});res.status(201).json(result);
 }));
 app.post('/payments/verify',asyncRoute(async(req,res)=>{const {bookingId}=z.object({bookingId:z.string()}).parse(req.body);const b=await ownedBooking(bookingId,res.locals.userId);if(!b.payment?.providerId)throw new HttpError(409,'Create payment first');if(b.payment.status==='SUCCEEDED'||b.payment.status==='REFUNDED'){res.json({status:b.status});return;}const verified=await provider(b.payment.provider).verifyPayment(b.payment.providerId,b.payment.amountPaise);if(!verified){res.status(202).json({status:'awaiting_payment'});return;}res.json(await applyPaymentEvent(b.payment.id,`verify:${b.payment.id}`,true));}));errors(app);return app;}

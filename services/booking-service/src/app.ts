import express from 'express';
import { z } from 'zod';
import { appBase, auth, asyncRoute, errors } from '../../../shared/http.js';
import { bookingInput, createBooking, ownedBooking, cancelBooking, bookingInclude } from '../../../shared/booking.js';
import { db } from '../../../shared/infra.js';
export function bookingApp(){const app=appBase();app.use(express.json({limit:'32kb'}),auth);
 app.post('/bookings',asyncRoute(async(req,res)=>{const key=z.string().min(8).max(128).parse(req.header('Idempotency-Key'));res.status(201).json(await createBooking(res.locals.userId,key,bookingInput.parse(req.body)));}));
 app.get('/bookings/:id',asyncRoute(async(req,res)=>res.json(await ownedBooking(req.params.id!,res.locals.userId))));
 app.get('/users/me/bookings',asyncRoute(async(req,res)=>res.json(await db.booking.findMany({where:{userId:res.locals.userId},include:bookingInclude,orderBy:{createdAt:'desc'},take:100}))));
 app.post('/bookings/:id/cancel',asyncRoute(async(req,res)=>res.json(await cancelBooking(req.params.id!,res.locals.userId))));errors(app);return app;}

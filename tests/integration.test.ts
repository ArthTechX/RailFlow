import { describe,it,expect,afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
// Opt-in: requires migrated PostgreSQL and Redis. No production database permitted.
const enabled=process.env.RUN_INTEGRATION==='1';
describe.skipIf(!enabled)('PostgreSQL + Redis concurrency and lifecycle',()=>{
 let cleanup:undefined|(()=>Promise<void>);
 afterAll(async()=>{await cleanup?.();});
 it('concurrent requests never share seats; cancellation releases them',async()=>{
  if(!process.env.DATABASE_URL?.includes('schema=railflow_test'))throw new Error('Integration tests require schema=railflow_test');
  const {db,redis}=await import('../shared/infra.js');const {createBooking,cancelBooking}=await import('../shared/booking.js');const {applyPaymentEvent}=await import('../shared/payment-events.js');
  const tag=randomUUID();const user=await db.user.create({data:{googleId:tag,email:`${tag}@example.test`,name:'Integration'}});
  const source=await db.station.create({data:{code:`S${tag}`,name:'Test source',city:'Test'}});const destination=await db.station.create({data:{code:`D${tag}`,name:'Test destination',city:'Test'}});
  const train=await db.train.create({data:{number:tag,name:'Test train',coaches:{create:{name:'A',class:'3A',seats:{create:[{number:1,berth:'LOWER'},{number:2,berth:'UPPER'}]}}},routes:{create:{}}},include:{coaches:{include:{seats:true}},routes:true}});
  const journey=await db.journey.create({data:{trainId:train.id,routeId:train.routes[0]!.id,sourceId:source.id,destinationId:destination.id,departureAt:new Date(Date.now()+86400000),arrivalAt:new Date(Date.now()+90000000),farePaise:1000,seats:{create:train.coaches[0]!.seats.map(s=>({seatId:s.id}))}}});
  cleanup=async()=>{const bookings=await db.booking.findMany({where:{userId:user.id}});const payments=await db.payment.findMany({where:{bookingId:{in:bookings.map(b=>b.id)}}});await db.outboxEvent.deleteMany({where:{OR:bookings.map(b=>({payload:{path:['bookingId'],equals:b.id}})).concat(payments.map(p=>({payload:{path:['paymentId'],equals:p.id}})))}});await db.webhookEvent.deleteMany({where:{id:{startsWith:tag}}});await db.journeySeat.deleteMany({where:{journeyId:journey.id}});await db.passenger.deleteMany({where:{booking:{userId:user.id}}});await db.payment.deleteMany({where:{booking:{userId:user.id}}});await db.booking.deleteMany({where:{userId:user.id}});await db.journey.delete({where:{id:journey.id}});await db.seat.deleteMany({where:{coach:{trainId:train.id}}});await db.coach.deleteMany({where:{trainId:train.id}});await db.route.deleteMany({where:{trainId:train.id}});await db.train.delete({where:{id:train.id}});await db.station.deleteMany({where:{id:{in:[source.id,destination.id]}}});await db.user.delete({where:{id:user.id}});await db.$disconnect();await redis.quit();};
  const book=(key:string)=>createBooking(user.id,key,{journeyId:journey.id,passengers:[{name:'Test passenger',age:25}]});
  const retry=async(key:string)=>{for(let attempt=0;attempt<30;attempt++){try{return await book(key);}catch(err){if(!(err instanceof Error)||!err.message.includes('Journey is busy')||attempt===29)throw err;await new Promise(resolve=>setTimeout(resolve,20));}}throw new Error('Retry exhausted');};
  const outcomes=await Promise.allSettled(Array.from({length:12},(_,i)=>retry(`integration-${i}`)));
  let allocated=await db.journeySeat.count({where:{journeyId:journey.id,passengerId:{not:null}}});
  expect(allocated).toBe(2);
  const allocations=await db.journeySeat.findMany({where:{journeyId:journey.id,passengerId:{not:null}}});expect(new Set(allocations.map(s=>s.passengerId)).size).toBe(allocations.length);
  const success=outcomes.find(x=>x.status==='fulfilled');expect(success?.status).toBe('fulfilled');if(success?.status!=='fulfilled')throw new Error('No booking');
  const b=success.value;expect((await book(b.idempotencyKey)).id).toBe(b.id);
  const payment=await db.payment.create({data:{bookingId:b.id,provider:'mock',providerId:`mock_${tag}`,amountPaise:b.amountPaise}});
  await applyPaymentEvent(payment.id,`${tag}-paid`,true);await applyPaymentEvent(payment.id,`${tag}-paid`,true);
  expect(await db.outboxEvent.count({where:{type:'confirmation',payload:{path:['bookingId'],equals:b.id}}})).toBe(1);
  await cancelBooking(b.id,user.id);expect(await db.journeySeat.count({where:{journeyId:journey.id,passengerId:{not:null}}})).toBe(allocated-1);
  const partial=await createBooking(user.id,`${tag}-partial`,{journeyId:journey.id,passengers:[{name:'One passenger',age:20},{name:'Two passenger',age:21},{name:'Three passenger',age:22}]});expect(partial.passengers.some(p=>p.status==='WAITLISTED')).toBe(true);
 });
});

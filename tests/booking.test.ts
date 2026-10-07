import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({tx:{booking:{findUnique:vi.fn(),findUniqueOrThrow:vi.fn(),create:vi.fn(),update:vi.fn()},journey:{findUniqueOrThrow:vi.fn()},journeySeat:{findMany:vi.fn(),updateMany:vi.fn()},passenger:{create:vi.fn()},payment:{findUniqueOrThrow:vi.fn(),update:vi.fn()},webhookEvent:{findUnique:vi.fn(),create:vi.fn()},outboxEvent:{create:vi.fn()}},db:{payment:{findUnique:vi.fn()}}}));
vi.mock('../shared/infra.js',()=>({db:mocks.db}));
vi.mock('../shared/locking.js',()=>({journeyTransaction:async(_id:string,fn:Function)=>fn(mocks.tx)}));
import { bookingInput,createBooking } from '../shared/booking.js';
import { applyPaymentEvent } from '../shared/payment-events.js';
const input={journeyId:'j',passengers:[{name:'Alice',age:30},{name:'Bob',age:31},{name:'Charlie',age:29}]};
beforeEach(()=>{vi.resetAllMocks();mocks.tx.booking.findUnique.mockResolvedValue(null);mocks.tx.journey.findUniqueOrThrow.mockResolvedValue({farePaise:1000,departureAt:new Date(Date.now()+86400000)});mocks.tx.booking.create.mockResolvedValue({id:'b'});mocks.tx.passenger.create.mockImplementation(async({data})=>({id:data.name,...data}));mocks.tx.journeySeat.updateMany.mockResolvedValue({count:1});});
describe('booking allocation',()=>{
 it('charges only allocated seats and waitlists overflow',async()=>{mocks.tx.journeySeat.findMany.mockResolvedValue([{id:'s1'},{id:'s2'}]);await createBooking('u','key-12345',input);expect(mocks.tx.booking.create.mock.calls[0]![0].data.amountPaise).toBe(2000);expect(mocks.tx.passenger.create.mock.calls.map(c=>c[0].data.status)).toEqual(['CONFIRMED','CONFIRMED','WAITLISTED']);expect(mocks.tx.journeySeat.updateMany).toHaveBeenCalledTimes(2);});
 it('rejects sold out bookings without creating records',async()=>{mocks.tx.journeySeat.findMany.mockResolvedValue([]);await expect(createBooking('u','key-12345',input)).rejects.toThrow('No seats');expect(mocks.tx.booking.create).not.toHaveBeenCalled();});
 it('detects a failed conditional seat claim',async()=>{mocks.tx.journeySeat.findMany.mockResolvedValue([{id:'s'}]);mocks.tx.journeySeat.updateMany.mockResolvedValue({count:0});await expect(createBooking('u','key-12345',input)).rejects.toThrow('conflict');});
 it('rejects changed payloads under the same idempotency key',async()=>{mocks.tx.booking.findUnique.mockResolvedValue({requestHash:'different'});await expect(createBooking('u','key-12345',input)).rejects.toThrow('another request');});
 it('rejects invalid passengers',()=>{expect(bookingInput.safeParse({...input,passengers:[{name:'A',age:-1}]}).success).toBe(false);});
});
describe('payment event transitions',()=>{
 const setup=(status='PENDING',expired=false)=>{const p={id:'p',status:'CREATED',booking:{id:'b',journeyId:'j',status,expiresAt:new Date(Date.now()+(expired?-60000:60000))}};mocks.db.payment.findUnique.mockResolvedValue(p);mocks.tx.payment.findUniqueOrThrow.mockResolvedValue(p);};
 it('confirms paid pending booking and persists notification in same transaction',async()=>{setup();expect(await applyPaymentEvent('p','event',true)).toEqual({status:'CONFIRMED'});expect(mocks.tx.outboxEvent.create).toHaveBeenCalledWith({data:{type:'confirmation',payload:{bookingId:'b'}}});});
 it('refunds late success without reclaiming released seats',async()=>{setup('PENDING',true);expect(await applyPaymentEvent('p','late',true)).toEqual({status:'CANCELLED'});expect(mocks.tx.outboxEvent.create).toHaveBeenCalledWith({data:{type:'refund',payload:{paymentId:'p'}}});expect(mocks.tx.journeySeat.updateMany).toHaveBeenCalledWith({where:{passenger:{bookingId:'b'}},data:{passengerId:null}});});
 it('replay does not enqueue another notification',async()=>{setup();mocks.tx.webhookEvent.findUnique.mockResolvedValue({id:'event'});expect(await applyPaymentEvent('p','event',true)).toEqual({duplicate:true});expect(mocks.tx.outboxEvent.create).not.toHaveBeenCalled();});
 it('payment failure releases pending inventory',async()=>{setup();await applyPaymentEvent('p','failure',false);expect(mocks.tx.booking.update).toHaveBeenCalledWith({where:{id:'b'},data:{status:'PAYMENT_FAILED'}});expect(mocks.tx.journeySeat.updateMany).toHaveBeenCalledOnce();});
});

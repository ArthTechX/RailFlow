import {describe,it,expect} from 'vitest';
// @ts-expect-error Prototype model is native browser JavaScript.
import {schedule,tomorrow,reserve,pay,cancel,available,expire} from '../demo/model.mjs';
const passenger=(name:string)=>({name,age:25});
describe('demo booking walkthrough',()=>{
 it('allocates available seats, waitlists overflow, and charges only seats',()=>{const train=schedule('NDLS','MMCT',tomorrow())[0];const b=reserve(train,'2A',[passenger('Alice'),passenger('Bob'),passenger('Charlie')],[]);expect(b.passengers.map((p:{status:string})=>p.status)).toEqual(['CONFIRMED','CONFIRMED','WAITLISTED']);expect(b.amount).toBe(6860);expect(available(train,'2A',[b])).toBe(0);expect(pay(b).status).toBe('CONFIRMED');});
 it('releases seats after failure and returns a refund on paid cancellation',()=>{const train=schedule('NDLS','MMCT',tomorrow())[0];const b=reserve(train,'3A',[passenger('Alice')],[]);expect(available(train,'3A',[b])).toBe(2);expect(available(train,'3A',[pay(b,false)])).toBe(3);const refunded=cancel(pay(b));expect(refunded.status).toBe('REFUNDED');expect(available(train,'3A',[refunded])).toBe(3);});
 it('chooses a free seat when another booking occupies the first one',()=>{const train=schedule('NDLS','MMCT',tomorrow())[0];const a=reserve(train,'3A',[passenger('Alice')],[]);const b=reserve(train,'3A',[passenger('Bob')],[a]);expect(a.passengers[0].seat).not.toBe(b.passengers[0].seat);});
 it('rejects invalid passengers and expires holds without charging',()=>{const train=schedule('NDLS','MMCT',tomorrow())[0];expect(()=>reserve(train,'3A',[{name:'A',age:-1}],[])).toThrow();const b=reserve(train,'3A',[passenger('Alice')],[]);expect(expire([b],b.expiresAt)[0].status).toBe('CANCELLED');expect(pay(b,true,b.expiresAt).status).toBe('CANCELLED');});
 it('rejects repeat payments and a class without seats',()=>{const train=schedule('NDLS','MMCT',tomorrow())[0];const b=reserve(train,'2A',[passenger('Alice'),passenger('Bob')],[]);expect(()=>reserve(train,'2A',[passenger('Charlie')],[b])).toThrow('sold out');expect(()=>pay(pay(b))).toThrow('no longer');});
});

import { describe,it,expect,vi,afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { validSignature, MockAdapter, StripeAdapter, RazorpayAdapter } from '../shared/payments.js';
import { config } from '../shared/config.js';
afterEach(()=>vi.unstubAllGlobals());
describe('payment trust boundary',()=>{
 it('accepts signed bytes and rejects tampering and malformed signatures',()=>{const body=Buffer.from('{"success":true}');const secret='secret';const signature=createHmac('sha256',secret).update(body).digest('hex');expect(validSignature(body,signature,secret)).toBe(true);expect(validSignature(Buffer.from('{"success":false}'),signature,secret)).toBe(false);expect(validSignature(body,'xyz',secret)).toBe(false);});
 it('mock verification never manufactures success',async()=>{const p=new MockAdapter();expect(await p.verifyPayment('mock_payment',100)).toBe(false);});
 it('Stripe verification validates amount and currency as well as paid status',async()=>{config.STRIPE_SECRET_KEY='sk_test';const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({payment_status:'paid',amount_total:100,currency:'inr'})});vi.stubGlobal('fetch',fetch);const p=new StripeAdapter();expect(await p.verifyPayment('session',100)).toBe(true);expect(await p.verifyPayment('session',200)).toBe(false);fetch.mockResolvedValue({ok:true,json:async()=>({payment_status:'paid',amount_total:100,currency:'usd'})});expect(await p.verifyPayment('session',100)).toBe(false);});
 it('Razorpay requires captured order payment in INR',async()=>{config.RAZORPAY_KEY_ID='test';config.RAZORPAY_KEY_SECRET='test';vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'paid',amount_paid:100,currency:'INR'})}));const p=new RazorpayAdapter();expect(await p.verifyPayment('order',100)).toBe(true);expect(await p.verifyPayment('order',101)).toBe(false);});
});

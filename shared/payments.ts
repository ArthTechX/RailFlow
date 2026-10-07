import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from './config.js';
import { HttpError } from './http.js';
export interface PaymentResult {id:string;checkoutUrl:string|null}
export interface PaymentProvider {createPayment(id:string,amountPaise:number):Promise<PaymentResult>;verifyPayment(id:string,amountPaise:number):Promise<boolean>;refundPayment(id:string,paymentId:string):Promise<void>}
async function request(url:string,headers:Record<string,string>,body?:URLSearchParams|object):Promise<any>{const r=await fetch(url,{method:body?'POST':'GET',headers:{...headers,...(body?{'Content-Type':body instanceof URLSearchParams?'application/x-www-form-urlencoded':'application/json'}:{})},body:body?(body instanceof URLSearchParams?body.toString():JSON.stringify(body)):undefined,signal:AbortSignal.timeout(10000)});if(!r.ok){console.error('Payment provider request failed',r.status);throw new HttpError(502,'Payment provider unavailable');}return r.json();}
export class MockAdapter implements PaymentProvider {
 async createPayment(id:string,_amount:number){return {id:`mock_${id}`,checkoutUrl:null};}
 // Mock payments require a signed webhook; verification cannot assert success.
 async verifyPayment(_id:string,_amount:number){return false;}
 async refundPayment(_id:string,_paymentId:string){}
}
export class StripeAdapter implements PaymentProvider {
 private headers(key?:string){if(!config.STRIPE_SECRET_KEY)throw new HttpError(503,'Stripe is not configured');return {Authorization:`Bearer ${config.STRIPE_SECRET_KEY}`,...(key?{'Idempotency-Key':key}:{})};}
 async createPayment(id:string,amount:number){const p=await request('https://api.stripe.com/v1/checkout/sessions',this.headers(id),new URLSearchParams({'mode':'payment','success_url':`${config.PUBLIC_URL}/?payment=success`,'cancel_url':`${config.PUBLIC_URL}/?payment=cancelled`,'line_items[0][price_data][currency]':'inr','line_items[0][price_data][unit_amount]':String(amount),'line_items[0][price_data][product_data][name]':'RailFlow reservation','line_items[0][quantity]':'1','metadata[paymentId]':id}));return {id:p.id as string,checkoutUrl:p.url as string};}
 async verifyPayment(id:string,amount:number){const p=await request(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`,this.headers());return p.payment_status==='paid'&&p.amount_total===amount&&p.currency==='inr';}
 async refundPayment(id:string,paymentId:string){const p=await request(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(id)}`,this.headers());await request('https://api.stripe.com/v1/refunds',this.headers(`refund_${paymentId}`),new URLSearchParams({payment_intent:p.payment_intent}));}
}
export class RazorpayAdapter implements PaymentProvider {
 private headers(){if(!config.RAZORPAY_KEY_ID||!config.RAZORPAY_KEY_SECRET)throw new HttpError(503,'Razorpay is not configured');return {Authorization:`Basic ${Buffer.from(`${config.RAZORPAY_KEY_ID}:${config.RAZORPAY_KEY_SECRET}`).toString('base64')}`};}
 async createPayment(id:string,amount:number){const p=await request('https://api.razorpay.com/v1/orders',this.headers(),{amount,currency:'INR',receipt:id});return {id:p.id as string,checkoutUrl:null};}
 async verifyPayment(id:string,amount:number){const p=await request(`https://api.razorpay.com/v1/orders/${encodeURIComponent(id)}`,this.headers());return p.status==='paid'&&p.amount_paid===amount&&p.currency==='INR';}
 async refundPayment(id:string,paymentId:string){const p=await request(`https://api.razorpay.com/v1/orders/${encodeURIComponent(id)}/payments`,this.headers());const captured=p.items.find((x:any)=>x.status==='captured');if(!captured)throw new Error('Captured Razorpay payment missing');if(captured.amount_refunded===captured.amount)return;await request(`https://api.razorpay.com/v1/payments/${encodeURIComponent(captured.id)}/refund`,this.headers(),{amount:captured.amount,notes:{railflowPaymentId:paymentId}});}
}
export function provider(name:string):PaymentProvider {switch(name){case 'mock':return new MockAdapter();case 'stripe':return new StripeAdapter();case 'razorpay':return new RazorpayAdapter();default:throw new HttpError(400,'Unknown payment provider');}}
export function validSignature(body:Buffer,signature:string,secret:string){const expected=createHmac('sha256',secret).update(body).digest();if(!/^[a-f0-9]{64}$/i.test(signature))return false;return timingSafeEqual(expected,Buffer.from(signature,'hex'));}

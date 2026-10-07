import { createHmac, randomUUID } from 'node:crypto';
const paymentId=process.argv[2];
if(!paymentId || !process.env.PAYMENT_WEBHOOK_SECRET){console.error('Usage: node --env-file=.env scripts/mock-payment.mjs PAYMENT_ID [failed]');process.exit(1);}
const body=JSON.stringify({id:randomUUID(),paymentId,success:process.argv[3]!=='failed'});
const signature=createHmac('sha256',process.env.PAYMENT_WEBHOOK_SECRET).update(body).digest('hex');
const r=await fetch(`${process.env.PUBLIC_URL || 'http://localhost:3000'}/payments/webhook`,{method:'POST',headers:{'Content-Type':'application/json','X-RailFlow-Signature':signature},body});
console.log(r.status,await r.text());if(!r.ok)process.exitCode=1;

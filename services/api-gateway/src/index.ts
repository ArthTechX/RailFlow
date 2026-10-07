import http from 'node:http';
import https from 'node:https';
import { appBase, errors, listen } from '../../../shared/http.js';
const app=appBase();
const targets:Record<string,string>={auth:process.env.AUTH_URL || 'http://localhost:3001',trains:process.env.SEARCH_URL || 'http://localhost:3002',stations:process.env.SEARCH_URL || 'http://localhost:3002',bookings:process.env.BOOKING_URL || 'http://localhost:3003',users:process.env.BOOKING_URL || 'http://localhost:3003',payments:process.env.PAYMENT_URL || 'http://localhost:3004'};
app.use((req,res,next)=>{
 const target=targets[req.path.split('/')[1] || ''];if(!target){next();return;}
 const upstream=new URL(target);const headers={...req.headers,host:upstream.host};delete headers.connection;
 const proxy=(upstream.protocol==='https:'?https:http).request({hostname:upstream.hostname,port:upstream.port,path:req.originalUrl,method:req.method,headers,timeout:20000},response=>{
  res.status(response.statusCode || 502);for(const [name,value] of Object.entries(response.headers))if(value!==undefined&&!['connection','transfer-encoding'].includes(name))res.setHeader(name,value);response.pipe(res);
 });
 proxy.on('timeout',()=>proxy.destroy(new Error('Upstream timeout')));proxy.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'Service unavailable'});else res.destroy();});req.on('aborted',()=>proxy.destroy());req.pipe(proxy);
});
errors(app);listen(app,Number(process.env.PORT || 3000));

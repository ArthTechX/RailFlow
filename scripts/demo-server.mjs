import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export function demoServer(){const root=fileURLToPath(new URL('../demo/',import.meta.url));const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.mjs':'app.mjs','/model.mjs':'model.mjs'};return createServer(async(req,res)=>{
 const name=files[new URL(req.url,'http://localhost').pathname];if(!name||!['GET','HEAD'].includes(req.method)){res.writeHead(404);res.end('Not found');return;}
 try{const body=await readFile(path.join(root,name));const mime=name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'text/javascript';res.writeHead(200,{'Content-Type':`${mime}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:body);}catch{res.writeHead(500);res.end('Unable to load demo');}
 });}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const port=Number(process.env.DEMO_PORT||3005);const server=demoServer();server.listen(port,'127.0.0.1',()=>console.log(`\nRailFlow demo is ready: http://localhost:${port}\nNo Docker or Google credentials required. Press Ctrl+C to stop.\n`));server.on('error',err=>{console.error(err.code==='EADDRINUSE'?`Port ${port} is busy. Run with DEMO_PORT=3006 npm run demo.`:err.message);process.exitCode=1;});for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close());}

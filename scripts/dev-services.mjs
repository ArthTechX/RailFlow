import { spawn } from 'node:child_process';
const children=['auth','search','booking','payment','notification'].map(name=>spawn(process.execPath,['node_modules/tsx/dist/cli.mjs','watch',`services/${name}-service/src/index.ts`],{stdio:'inherit',env:process.env}));
let closing=false;
function stop(){if(closing)return;closing=true;for(const child of children)child.kill('SIGTERM');}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,stop);
for(const child of children)child.on('exit',code=>{if(!closing){process.exitCode=code || 1;stop();}});

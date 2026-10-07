import { db, redis, elastic } from '../shared/infra.js';
async function seed(){
 const delhi=await db.station.upsert({where:{code:'NDLS'},create:{code:'NDLS',name:'New Delhi',city:'Delhi'},update:{}});
 const mumbai=await db.station.upsert({where:{code:'MMCT'},create:{code:'MMCT',name:'Mumbai Central',city:'Mumbai'},update:{}});
 const train=await db.train.upsert({where:{number:'12952'},create:{number:'12952',name:'Mumbai Rajdhani'},update:{}});
 let route=await db.route.findFirst({where:{trainId:train.id}});if(!route)route=await db.route.create({data:{trainId:train.id,stops:{create:[{stationId:delhi.id,position:0,arrivalMinutes:0,departureMinutes:0},{stationId:mumbai.id,position:1,arrivalMinutes:960,departureMinutes:960}]}}});
 const coach=await db.coach.upsert({where:{trainId_name:{trainId:train.id,name:'B1'}},create:{trainId:train.id,name:'B1',class:'3A'},update:{}});
 for(let i=1;i<=24;i++)await db.seat.upsert({where:{coachId_number:{coachId:coach.id,number:i}},create:{coachId:coach.id,number:i,berth:['LOWER','MIDDLE','UPPER'][(i-1)%3]!},update:{}});
 const seats=await db.seat.findMany({where:{coachId:coach.id}});
 for(let day=1;day<=30;day++){const date=new Date();date.setUTCDate(date.getUTCDate()+day);date.setUTCHours(11,0,0,0);let j=await db.journey.findFirst({where:{trainId:train.id,departureAt:date}});if(!j)j=await db.journey.create({data:{trainId:train.id,routeId:route.id,sourceId:delhi.id,destinationId:mumbai.id,departureAt:date,arrivalAt:new Date(date.getTime()+16*3600000),farePaise:245000}});await db.journeySeat.createMany({data:seats.map(s=>({journeyId:j!.id,seatId:s.id})),skipDuplicates:true});}
 for(const index of ['stations','trains'])if(!(await elastic.indices.exists({index})))await elastic.indices.create({index});
 for(const s of await db.station.findMany())await elastic.index({index:'stations',id:s.id,document:s});
 for(const t of await db.train.findMany())await elastic.index({index:'trains',id:t.id,document:t});
 await elastic.indices.refresh({index:['stations','trains']});console.log('Seeded Delhi → Mumbai journeys for the next 30 days');
}
seed().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await db.$disconnect();await redis.quit();await elastic.close();});

export const stations = [
  {code:'NDLS',name:'New Delhi',city:'Delhi'}, {code:'MMCT',name:'Mumbai Central',city:'Mumbai'},
  {code:'SBC',name:'Bengaluru City',city:'Bengaluru'}, {code:'MAS',name:'Chennai Central',city:'Chennai'}
];
const routes = [
 ['NDLS','MMCT','Mumbai Rajdhani','12952','16:30','08:30',16,2450],
 ['NDLS','MMCT','August Kranti Express','12954','17:15','10:05',16.83,2180],
 ['NDLS','MMCT','Golden Temple Mail','12904','19:00','14:10',19.17,1620],
 ['SBC','MAS','Shatabdi Express','12028','06:00','11:00',5,920],
 ['SBC','MAS','Brindavan Express','12640','15:10','21:00',5.83,650],
 ['NDLS','SBC','Bengaluru Rajdhani','22692','19:50','05:20',33.5,3850],
 ['MMCT','SBC','Udyan Express','11301','08:10','07:50',23.67,2250],
 ['NDLS','MAS','Chennai Rajdhani','12434','15:35','20:40',29.08,3420],
 ['MMCT','MAS','Chennai Express','22159','12:45','11:05',22.33,2480]
];
export function localDate(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function tomorrow(){const d=new Date();d.setDate(d.getDate()+1);return localDate(d);}
export function schedule(source,destination,date){return routes.filter(r=>(r[0]===source&&r[1]===destination)||(r[1]===source&&r[0]===destination)).map((r,i)=>({id:`${r[4].replace(':','')}-${r[3]}-${source}-${date}`,source,destination,date,name:r[2],number:r[3],departure:r[4],arrival:r[5],duration:r[6],fare:r[7],capacity:{'3A':i===0?3:18,'2A':i===0?2:12,'SL':i===0?8:42}}));}
export function fare(train,seatClass){return Math.round(train.fare*({'3A':1,'2A':1.4,'SL':0.45}[seatClass]??1));}
const holdsSeat=b=>b.status==='CONFIRMED'||b.status==='PENDING';
export function available(train,seatClass,bookings){return Math.max(0,train.capacity[seatClass]-bookings.filter(b=>b.train.id===train.id&&b.seatClass===seatClass&&holdsSeat(b)).reduce((n,b)=>n+b.passengers.filter(p=>p.status==='CONFIRMED').length,0));}
export function reserve(train,seatClass,passengers,bookings,now=Date.now()){
 if(!['3A','2A','SL'].includes(seatClass))throw new Error('Choose a travel class.');
 if(!passengers.length||passengers.length>6)throw new Error('Add between 1 and 6 passengers.');
 if(passengers.some(p=>typeof p.name!=='string'||p.name.trim().length<2||!Number.isInteger(p.age)||p.age<1||p.age>120))throw new Error('Enter a full name and an age between 1 and 120 for every passenger.');
 if(train.date<localDate(new Date(now)))throw new Error('Choose today or a future date.');
 const seats=available(train,seatClass,bookings);if(seats===0)throw new Error('This class is sold out. Please choose another train or class.');
 const taken=new Set(bookings.filter(b=>b.train.id===train.id&&b.seatClass===seatClass&&holdsSeat(b)).flatMap(b=>b.passengers.map(p=>p.seat).filter(Boolean)));
 const free=Array.from({length:train.capacity[seatClass]},(_,i)=>`${seatClass==='SL'?'S1':seatClass==='2A'?'A1':'B1'} · ${i+1}`).filter(s=>!taken.has(s));
 return {id:crypto.randomUUID(),pnr:`RF${crypto.randomUUID().replaceAll('-','').slice(0,8).toUpperCase()}`,train,seatClass,status:'PENDING',createdAt:now,expiresAt:now+15*60000,amount:fare(train,seatClass)*Math.min(seats,passengers.length),passengers:passengers.map((p,i)=>({name:p.name.trim(),age:p.age,status:i<seats?'CONFIRMED':'WAITLISTED',seat:i<seats?free[i]:null}))};
}
export function pay(booking,success=true,now=Date.now()){
 if(booking.status!=='PENDING')throw new Error('This booking is no longer awaiting payment.');
 if(booking.expiresAt<=now)return {...booking,status:'CANCELLED'};
 return {...booking,status:success?'CONFIRMED':'PAYMENT_FAILED'};
}
export function cancel(booking){if(!['PENDING','CONFIRMED'].includes(booking.status))return booking;return {...booking,status:booking.status==='CONFIRMED'?'REFUNDED':'CANCELLED'};}
export function expire(bookings,now=Date.now()){return bookings.map(b=>b.status==='PENDING'&&b.expiresAt<=now?{...b,status:'CANCELLED'}:b);}

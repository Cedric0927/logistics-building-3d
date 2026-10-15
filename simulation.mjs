export const DOCK_X=1.22;
export const PHASES=[
  {id:'arrive',title:'货车驶入',duration:10,detail:'货车沿场院车道驶入，准备停靠 07 号月台。'},
  {id:'reverse',title:'倒车靠台',duration:9,detail:'货车倒车进入装卸位，叉车在暂存区等待。'},
  {id:'open',title:'打开货门',duration:3,detail:'车辆停稳，双开货门展开，开始卸货。'},
  {id:'unload-0',title:'卸下第 1 托',duration:20,detail:'叉车取出第一托货物，搬运到分拨暂存区。'},
  {id:'unload-1',title:'卸下第 2 托',duration:20,detail:'叉车返回月台，继续卸下第二托货物。'},
  {id:'unload-2',title:'卸下第 3 托',duration:20,detail:'最后一托货物卸下，车厢清空。'},
  {id:'close',title:'关闭货门',duration:3,detail:'叉车退出作业区，货车关闭货门。'},
  {id:'depart',title:'货车驶离',duration:12,detail:'卸货完成，货车驶出月台，释放装卸位。'}
];
let sum=0;
for(const p of PHASES){p.start=sum;sum+=p.duration;p.end=sum;Object.freeze(p)}
export const TOTAL=sum;
export const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
export const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
export const lerp=(a,b,t)=>a+(b-a)*t;
export function polyline(points,progress){
  const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0),d=clamp(progress)*total;
  const pointAt=distance=>{let left=clamp(distance,0,total);for(let i=0;i<lengths.length;i++){if(left<=lengths[i]||i===lengths.length-1){const t=left/lengths[i];return [lerp(points[i][0],points[i+1][0],t),lerp(points[i][1],points[i+1][1],t)]}left-=lengths[i]}};
  const p=pointAt(d),a=pointAt(d-.5),b=pointAt(d+.5);
  return {x:p[0],z:p[1],yaw:Math.atan2(b[0]-a[0],b[1]-a[1]),distance:d};
}
export function sample(time){
  const t=clamp(time,0,TOTAL),done=t>=TOTAL,phase=PHASES.find(p=>t<p.end)||PHASES.at(-1),u=clamp((t-phase.start)/phase.duration);
  let truck={x:DOCK_X,z:12.2,yaw:0,distance:0};
  if(phase.id==='arrive')truck=polyline([[-34,23],[-12,23],[-2,20],[DOCK_X,20],[DOCK_X,23]],smooth(u));
  else if(phase.id==='reverse'){truck.z=lerp(23,12.2,smooth(u));truck.distance=23-truck.z}
  else if(phase.id==='depart')truck=polyline([[DOCK_X,12.2],[DOCK_X,20],[10,24],[34,24]],smooth(u));
  const doors=t<19?0:t<22?smooth((t-19)/3):t<82?1:t<85?1-smooth((t-82)/3):0;
  const index=Math.min(2,Math.max(0,Math.floor((t-22)/20)));
  let completed=t<22?0:Math.min(3,Math.max(0,Math.floor((t-22)/20))),forklift={x:12,z:16,yaw:Math.PI/2,distance:0},carry=-1,loadHeight=.18,action='在分拨区待命';
  if(t>=22&&t<82){
    const v=t-22-index*20,dropZ=16+index*2.5,previousZ=16+Math.max(0,index-1)*2.5;
    const inbound=[[12,previousZ],[6,previousZ],[6,4.3],[DOCK_X,4.3],[DOCK_X,6.4]],outbound=[[DOCK_X,6.4],[DOCK_X,4.3],[6,4.3],[6,dropZ],[12,dropZ]];
    if(v<8){forklift=polyline(inbound,smooth(v/8));loadHeight=lerp(.18,1.17,clamp(v/5));action='驶向车尾取货'}
    else if(v<9.5){forklift=polyline(inbound,1);loadHeight=lerp(1.17,1.35,smooth((v-8)/1.5));action='抬升货叉';if(v>=9)carry=index}
    else if(v<18){forklift=polyline(outbound,smooth((v-9.5)/8.5));if(forklift.distance<2.1)forklift.yaw=0;loadHeight=1.35;carry=index;action='搬运至分拨区'}
    else{forklift={...polyline(outbound,1),yaw:Math.PI/2};loadHeight=lerp(1.35,.18,smooth((v-18)/1.5));carry=v<19.5?index:-1;completed=index+(v>=19.5?1:0);action='放下托盘货物'}
  }else if(t>=82){forklift={x:12,z:21,yaw:Math.PI/2,distance:0};completed=3;action='卸货已完成'}
  const pallets=Array.from({length:3},(_,i)=>({id:i,mode:i<completed?'sorted':i===carry?'carried':'truck',slot:Math.max(0,i-(t>=22?index:0))}));
  return {time:t,phase:phase.id,title:done?'本轮作业完成':phase.title,detail:done?'三托货物已全部转入分拨区，货车已驶离。可重置后再次演示。':phase.detail,progress:t/TOTAL,phaseProgress:u,done,truck,doors,completed,pallets,forklift,loadHeight,action,dockBusy:t>=10&&t<90};
}
export function nextPhase(time){return PHASES.find(p=>p.start>time+.01)?.start??TOTAL}

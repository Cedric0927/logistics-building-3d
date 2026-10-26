export const DOCK_X=1.22;
export const CARGO_COUNT=12;
export const PHASES=[
  {id:'arrive',title:'货车驶入',duration:10,detail:'货车沿场院车道驶入，准备停靠 07 号月台。'},
  {id:'reverse',title:'倒车靠台',duration:9,detail:'货车倒车停靠 07 号月台，对准分拨入线传送带。'},
  {id:'open',title:'打开货门',duration:3,detail:'车辆停稳，双开货门展开，开始卸货。'},
  {id:'extend',title:'传送带伸入车厢',duration:6,detail:'伸缩传送带从月台伸进车厢，与室内分拨线连通。'},
  {id:'unload',title:'传送带直接卸货',duration:32,detail:'纸箱依次上带，直接输送进入厂房分拨线。'},
  {id:'retract',title:'收回传送带',duration:5,detail:'12 件纸箱已全部进入分拨区，清空后收回伸缩段。'},
  {id:'close',title:'关闭货门',duration:3,detail:'传送带已完全收回，货车关闭双开货门。'},
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
  if(phase.id==='arrive')truck=polyline([[-24,24],[-12,24],[-2,20],[DOCK_X,20],[DOCK_X,23]],smooth(u));
  else if(phase.id==='reverse'){truck.z=lerp(23,12.2,smooth(u));truck.distance=23-truck.z}
  else if(phase.id==='depart')truck=polyline([[DOCK_X,12.2],[DOCK_X,20],[10,24],[34,24]],smooth(u));
  const doors=t<19?0:t<22?smooth((t-19)/3):t<65?1:t<68?1-smooth((t-65)/3):0;
  const extension=t<22?0:t<28?smooth((t-22)/6):t<60?1:t<65?1-smooth((t-60)/5):0;
  const parcels=Array.from({length:CARGO_COUNT},(_,i)=>{
    const age=t-(28+i*1.8),local={x:i%2===0?-.99:.99,y:1.19+(1-Math.floor(i/6))*.63,z:-3+Math.floor((i%6)/2)*1.25};
    if(age<0)return {id:i,mode:'truck',local};
    const startZ=12.2+local.z,travel=(startZ+1)/2.07;
    if(age<1.2){const p=smooth(age/1.2);return {id:i,mode:'feeding',x:lerp(DOCK_X+local.x,DOCK_X,p),y:lerp(local.y,1.42,p),z:startZ}}
    if(age<1.2+travel)return {id:i,mode:'belt',x:DOCK_X,y:1.42,z:startZ-(age-1.2)*2.07};
    return {id:i,mode:'inside'};
  });
  const completed=parcels.filter(p=>p.mode==='inside').length;
  const onBelt=parcels.filter(p=>p.mode==='belt'||p.mode==='feeding').length;
  const action=phase.id==='extend'?'伸缩段正在伸入':phase.id==='unload'?`入线输送中 · ${onBelt} 件在线`:phase.id==='retract'?'伸缩段正在收回':t>=65?'传送带已收回':'传送带待命';
  return {time:t,phase:phase.id,title:done?'本轮作业完成':phase.title,detail:done?'12 件纸箱已直接进入厂房分拨线，货车已驶离。':phase.detail,progress:t/TOTAL,phaseProgress:u,done,truck,doors,extension,completed,onBelt,parcels,action,beltTravel:clamp(t-28,0,32)*2.07,dockBusy:t>=10&&t<73};
}
export function nextPhase(time){return PHASES.find(p=>p.start>time+.01)?.start??TOTAL}

// Artistic lighting presets, independent of the logistics timeline and location.
const KEYS=[
  [0,0,.24,.045,.10,1,'#071323','#263347','#91a4d0'],
  [5,0,.24,.045,.10,1,'#0c192c','#364456','#adb5d1'],
  [6.5,.7,.95,.15,.32,.45,'#697e9c','#e8b89c','#ffbd8a'],
  [9,2.8,2.7,.28,.60,0,'#b8d6e5','#e9eee4','#fff0d4'],
  [12,3.2,3,.30,.65,0,'#c6e0ea','#edf0e5','#fff6df'],
  [15,2.9,2.6,.25,.56,0,'#b3cfdd','#e4e6d5','#ffedca'],
  [18.3,1.0,1.1,.12,.32,.48,'#766d8d','#efb28c','#ffad68'],
  [20,0,.29,.05,.12,1,'#111b36','#354257','#8fa0cb'],
  [24,0,.24,.045,.10,1,'#071323','#263347','#91a4d0']
];
const lerp=(a,b,t)=>a+(b-a)*t;
function color(a,b,t){let out='#';for(let i=1;i<7;i+=2)out+=Math.round(lerp(parseInt(a.slice(i,i+2),16),parseInt(b.slice(i,i+2),16),t)).toString(16).padStart(2,'0');return out}
export function lightingProfile(hour){
  const h=((hour%24)+24)%24;
  const end=KEYS.findIndex(k=>k[0]>h),a=KEYS[end-1],b=KEYS[end],t=(h-a[0])/(b[0]-a[0]),e=t*t*(3-2*t);
  return {hour:h,sun:lerp(a[1],b[1],e),sky:lerp(a[2],b[2],e),ambient:lerp(a[3],b[3],e),environment:lerp(a[4],b[4],e),lamps:lerp(a[5],b[5],e),top:color(a[6],b[6],e),bottom:color(a[7],b[7],e),sunColor:color(a[8],b[8],e)};
}
export function formatHour(hour){const m=Math.round(hour*60);return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`}

import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {sample,nextPhase,TOTAL,DOCK_X,CARGO_COUNT} from './simulation.mjs';

const $=s=>document.querySelector(s),container=$('#scene');
let renderer,ready=false,playing=false,time=0,last=performance.now(),speed=1,lastTitle='';
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,.1,400);
let controls;
const truck=new THREE.Group(),conveyor=new THREE.Group();
const wheels=[],parcels=[],cutawayParts=[],beltSections=[],beltTreads=[];
const mats={};
const material=(color,opts={})=>new THREE.MeshStandardMaterial({color,roughness:.65,...opts});
mats.white=material('#eef0e8');mats.dark=material('#263a3b');mats.glass=material('#254655',{metalness:.35,roughness:.25});
mats.green=material('#28664b');mats.yellow=material('#e7a938');mats.rubber=material('#24292a');mats.steel=material('#b7c4bf',{metalness:.55,roughness:.38});
mats.wood=material('#aa8250');mats.box=material('#c9a878');mats.tape=material('#e5cb9e');mats.orange=material('#d68d32');
function box(parent,size,pos,mat){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
function wheel(parent,x,z,r,width,list){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,width,20),mats.rubber);m.rotation.z=Math.PI/2;m.position.set(x,r,z);m.castShadow=true;parent.add(m);const rim=new THREE.Mesh(new THREE.CylinderGeometry(r*.55,r*.55,width+.025,16),mats.steel);rim.rotation.z=Math.PI/2;m.add(rim);rim.rotation.set(0,0,0);list.push(m);return m}
function labelTexture(body,bg='#eff2e8',color='#28553e'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,1024,256);ctx.font='bold 78px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(body,512,130);
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function label(body,pos,width=5,color='#28553e'){
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:labelTexture(body, '#eff2e8',color),depthTest:false}));sprite.position.set(...pos);sprite.scale.set(width,width/4,1);sprite.renderOrder=5;scene.add(sprite);return sprite;
}
function plate(parent,body,pos,width,rotationY=0){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:labelTexture(body,'#28664b','#ffffff'),side:THREE.DoubleSide}));mesh.position.set(...pos);mesh.rotation.y=rotationY;parent.add(mesh)}
function makeTruck(){
  truck.name='Animated delivery truck';scene.add(truck);
  box(truck,[2.5,.3,8.4],[0,.73,0],mats.dark);
  box(truck,[2.7,.16,5.8],[0,1.10,-1.3],mats.steel);
  for(const x of [-1.4,1.4]){const wall=box(truck,[.12,2.9,5.9],[x,2.6,-1.3],mats.white.clone());cutawayParts.push(wall);box(truck,[.04,.36,5.85],[x*1.05,2.25,-1.3],mats.green)}
  const roof=box(truck,[2.95,.12,6.05],[0,4.1,-1.3],mats.white);cutawayParts.push(roof);
  cutawayParts.push(box(truck,[2.8,2.9,.12],[0,2.6,1.65],mats.white.clone()));
  box(truck,[2.55,1.5,2.5],[0,1.55,2.95],mats.white);
  box(truck,[2.25,.8,1.9],[0,2.5,2.9],mats.white);
  box(truck,[2.05,.65,.05],[0,2.5,3.88],mats.glass);
  for(const x of [-1.15,1.15]){box(truck,[.035,.64,1.5],[x,2.46,2.95],mats.glass);box(truck,[.23,.42,.32],[x*1.26,2.35,3.55],mats.dark)}
  box(truck,[2.6,.22,.22],[0,.8,4.25],mats.dark);
  box(truck,[1.25,.40,.04],[0,1.30,4.22],mats.dark);
  for(const x of [-.95,.95])box(truck,[.4,.23,.055],[x,1.3,4.23],mats.white);
  box(truck,[.55,.18,.04],[0,.85,4.38],mats.green);
  for(const x of [-1.27,1.27])for(const z of [-2.9,2.8])wheel(truck,x,z,.56,.31,wheels);
  const doors=[];
  for(const side of [-1,1]){const pivot=new THREE.Group();pivot.position.set(side*1.4,2.59,-4.26);truck.add(pivot);box(pivot,[1.38,2.85,.10],[-side*.69,0,0],mats.white);box(pivot,[.05,2.4,.07],[-side*.7,0,-.08],mats.steel);box(pivot,[1.3,.13,.05],[-side*.69,-.45,-.07],mats.green);doors.push(pivot)}
  plate(truck,'物流运输 · 01',[-1.47,3,-1.3],3.8,-Math.PI/2);
  plate(truck,'物流运输 · 01',[1.47,3,-1.3],3.8,Math.PI/2);
  return doors;
}
function makeConveyor(){
  conveyor.name='Telescopic unloading conveyor';conveyor.position.x=DOCK_X;scene.add(conveyor);
  box(conveyor,[1.5,.35,7.8],[0,1.12,2.9],mats.green);
  box(conveyor,[1.13,.09,7.8],[0,1.34,2.9],mats.rubber);
  for(const x of [-.7,.7]){
    box(conveyor,[.11,.18,7.8],[x,1.38,2.9],mats.yellow);
    for(const z of [1,5.5])box(conveyor,[.13,.6,.15],[x,.91,z],mats.steel);
  }
  box(conveyor,[.5,.36,.45],[1,1.28,5.2],mats.yellow);
  box(conveyor,[.12,.08,.12],[1,1.5,5.2],material('#d54d36'));
  for(let i=0;i<3;i++){
    const g=new THREE.Group(),width=1.42-i*.11;conveyor.add(g);beltSections.push(g);
    box(g,[width,.22,2.4],[0,1.17,0],mats.steel);
    box(g,[1.02,.08,2.4],[0,1.35+i*.006,0],mats.rubber);
    for(const x of [-width/2,width/2])box(g,[.07,.16,2.4],[x,1.37,0],mats.yellow);
    for(const z of [-1.1,1.1]){const roller=new THREE.Mesh(new THREE.CylinderGeometry(.115,.115,1.06,12),mats.steel);roller.rotation.z=Math.PI/2;roller.position.set(0,1.27,z);g.add(roller)}
  }
  for(let i=0;i<65;i++)beltTreads.push(box(conveyor,[.99,.014,.045],[0,1.405,0],mats.dark));
}
function makeParcel(i){
  const p=new THREE.Group();p.name='Carton '+(i+1);scene.add(p);
  box(p,[.60,.57,.59],[0,.285,0],i%3===0?mats.box:mats.wood);
  box(p,[.085,.012,.60],[0,.577,0],mats.tape);
  box(p,[.085,.57,.012],[0,.285,.30],mats.tape);
  box(p,[.22,.13,.014],[-.16,.35,.307],mats.white);
  return p;
}
function zone(x,z,w,d,color){
  const m=box(scene,[w,.035,d],[x,.025,z],new THREE.MeshStandardMaterial({color,transparent:true,opacity:.16,depthWrite:false}));m.receiveShadow=false;
  const pts=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2],[-w/2,-d/2]].map(([a,b])=>new THREE.Vector3(x+a,.065,z+b));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color,dashSize:.45,gapSize:.25}));line.computeLineDistances();scene.add(line);
}
function setupScene(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','三维物流场院：货车、伸缩传送带与入线纸箱');
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.025;controls.minDistance=12;controls.maxDistance=160;
  scene.add(new THREE.HemisphereLight(0xf6faff,0xbab09a,3));
  const sun=new THREE.DirectionalLight(0xfff6df,3.2);sun.position.set(-30,60,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-50,right:50,top:45,bottom:-45,near:1,far:150});sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff,.3));
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.ShadowMaterial({opacity:.14}));ground.rotation.x=-Math.PI/2;ground.position.y=-.45;ground.receiveShadow=true;scene.add(ground);
  zone(DOCK_X,13,4.2,10,'#3b8b65');
  label('07 号月台 · 直送分拨线',[DOCK_X,5.3,7.5],7.3);
  setView('overview');new ResizeObserver(resize).observe(container);resize();
}
function resize(){if(!renderer)return;const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function setView(view){if(!controls)return;const aspect=container.clientWidth/container.clientHeight;const presets={overview:{pos:aspect<1?[-82,80,135]:[-53,44,83],target:[0,6,7]},dock:{pos:[-12,20,27],target:[DOCK_X,2,9]},top:{pos:[0,112,15],target:[0,0,7]}};const v=presets[view];camera.position.set(...v.pos);controls.target.set(...v.target);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view))}
let doors;
function renderState(){
  const s=sample(time);truck.position.set(s.truck.x,.01,s.truck.z);truck.rotation.y=s.truck.yaw;
  wheels.forEach(w=>w.rotation.x=s.truck.distance/.56);doors[0].rotation.y=-s.doors*Math.PI*.8;doors[1].rotation.y=s.doors*Math.PI*.8;
  beltSections.forEach((part,i)=>{part.position.z=5.65+2.1*(i+1)*s.extension});
  const head=6.85+6.3*s.extension;
  beltTreads.forEach((tread,i)=>{const z=-1+((i*.23-s.beltTravel)%14.95+14.95)%14.95;tread.visible=z<head-.03;tread.position.z=z});
  const cutaway=$('#cutaway').checked;
  for(const i of [0,1,3]){const wall=cutawayParts[i];wall.material.transparent=cutaway;wall.material.opacity=cutaway?.13:1;wall.material.depthWrite=!cutaway;wall.castShadow=!cutaway}
  cutawayParts[2].visible=!cutaway;
  for(const p of s.parcels){
    const mesh=parcels[p.id];mesh.visible=p.mode!=='inside';
    if(p.mode==='truck'){const v=new THREE.Vector3(p.local.x,p.local.y,p.local.z);v.applyAxisAngle(new THREE.Vector3(0,1,0),s.truck.yaw).add(truck.position);mesh.position.copy(v);mesh.rotation.y=s.truck.yaw}
    else if(p.mode!=='inside'){mesh.position.set(p.x,p.y,p.z);mesh.rotation.y=0}
  }
  if(lastTitle!==s.title){$('#phase-title').textContent=s.title;$('#phase-detail').textContent=s.detail;lastTitle=s.title}
  $('#count').textContent=s.completed;$('#dock-status').textContent=s.dockBusy?'作业中':'空闲';$('#belt-status').textContent=s.action;
  $('#run-badge').textContent=s.done?'已完成':playing?'运行中':'已暂停';$('#play').textContent=s.done?'再次演示':playing?'暂停作业':time>0?'继续作业':'开始作业';$('#play').setAttribute('aria-pressed',String(playing));
  $('#timeline').value=time;$('#clock').textContent=format(time)+' / '+format(TOTAL);
  const active=s.done?6:s.phase==='arrive'?0:['reverse','open'].includes(s.phase)?1:s.phase==='extend'?2:s.phase==='unload'?3:['retract','close'].includes(s.phase)?4:5;
  $('#steps').querySelectorAll('li').forEach((el,i)=>{el.classList.toggle('active',i===active);el.classList.toggle('complete',i<active)});
}
const format=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
function toggle(){if(!ready)return;if(time>=TOTAL)time=0;playing=!playing;renderState()}
$('#play').addEventListener('click',toggle);
$('#reset').addEventListener('click',()=>{time=0;playing=false;renderState()});
$('#next').addEventListener('click',()=>{time=nextPhase(time);playing=false;renderState()});
$('#timeline').max=TOTAL;$('#timeline').addEventListener('input',e=>{time=Number(e.target.value);playing=false;renderState()});
$('#speed').addEventListener('change',e=>{speed=Number(e.target.value)});
$('#cutaway').addEventListener('change',()=>{if(ready)renderState()});
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.addEventListener('keydown',e=>{if(/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();toggle()}else if(e.code==='KeyR'&&ready){time=0;playing=false;renderState()}});
document.addEventListener('visibilitychange',()=>{last=performance.now()});
function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(ready){if(playing&&!document.hidden){time+=dt*speed;if(time>=TOTAL){if($('#loop').checked)time%=TOTAL;else{time=TOTAL;playing=false}}}renderState()}controls?.update();renderer?.render(scene,camera);requestAnimationFrame(frame)}
try{
  setupScene();doors=makeTruck();makeConveyor();for(let i=0;i<CARGO_COUNT;i++)parcels.push(makeParcel(i));
  const gltf=await new GLTFLoader().loadAsync('./logistics-building.glb');
  const remove=[];gltf.scene.traverse(obj=>{if(/Vehicle[_ ]0[34]/.test(obj.name)||/Loading.*bay[_ ]07.*dark[_ ]opening/.test(obj.name))remove.push(obj);if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;if(obj.material.map)obj.material.map.anisotropy=4}});
  remove.forEach(obj=>obj.removeFromParent());scene.add(gltf.scene);
  ready=true;$('#load-status').textContent='场景已就绪 · 07 号月台';$('#loading').hidden=true;
  for(const id of ['play','reset','next','timeline'])$('#'+id).disabled=false;
  renderState();requestAnimationFrame(frame);
}catch(error){console.error(error);$('#load-status').textContent='场景加载失败';$('#loading').textContent='无法加载 3D 场景。请检查浏览器 WebGL 支持及本地文件，或打开右上角的静态建筑预览。'}

import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {sample,nextPhase,TOTAL,DOCK_X,clamp} from './simulation.mjs';

const $=s=>document.querySelector(s),container=$('#scene');
let renderer,ready=false,playing=false,time=0,last=performance.now(),speed=1,lastTitle='';
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(40,1,.1,400);
let controls;
const truck=new THREE.Group(),forklift=new THREE.Group(),forks=new THREE.Group();
const wheels=[],forkWheels=[],pallets=[],cutawayParts=[];
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
  box(truck,[2.8,2.9,.12],[0,2.6,1.65],mats.white);
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
function makeForklift(){
  forklift.name='Animated forklift';scene.add(forklift);
  box(forklift,[1.65,.65,2.25],[0,.65,-.12],mats.yellow);
  box(forklift,[1.4,.5,.55],[0,1.06,-.9],mats.yellow);
  box(forklift,[.68,.23,.68],[0,1.38,-.12],mats.dark);
  const back=box(forklift,[.7,.6,.16],[0,1.67,-.42],mats.dark);back.rotation.x=-.18;
  for(const x of [-.7,.7])for(const z of [-.82,.62])box(forklift,[.065,1.75,.065],[x,1.9,z],mats.dark);
  box(forklift,[1.65,.12,1.8],[0,2.8,-.12],mats.dark);
  for(const x of [-.57,.57]){box(forklift,[.13,2.9,.17],[x,1.5,.9],mats.dark);box(forklift,[.06,2.5,.08],[x,1.55,1.01],mats.steel)}
  box(forklift,[1.3,.10,.18],[0,2.83,.9],mats.dark);
  for(const x of [-.82,.82])for(const z of [-.73,.68])wheel(forklift,x,z,.34,.23,forkWheels);
  forklift.add(forks);
  box(forks,[1.35,.2,.22],[0,.07,1.02],mats.steel);
  for(const x of [-.46,.46]){box(forks,[.14,.10,2.25],[x,0,2.05],mats.steel);box(forks,[.14,.65,.12],[x,.27,1.0],mats.steel)}
}
function makePallet(i){
  const p=new THREE.Group();p.name='Pallet '+(i+1);scene.add(p);
  for(const x of [-.62,0,.62])box(p,[.15,.16,1.38],[x,.08,0],mats.wood);
  for(const z of [-.58,-.29,0,.29,.58])box(p,[1.7,.08,.22],[0,.20,z],mats.wood);
  for(let y=0;y<2;y++)for(const x of [-.42,.42])for(const z of [-.34,.34]){box(p,[.79,.52,.64],[x,.51+y*.53,z],mats.box);box(p,[.1,.012,.65],[x,.775+y*.53,z],mats.tape)}
  for(const x of [-.55,.55])box(p,[.035,1.2,1.37],[x,.86,0],mats.orange);
  return p;
}
function zone(x,z,w,d,color){
  const m=box(scene,[w,.035,d],[x,.025,z],new THREE.MeshStandardMaterial({color,transparent:true,opacity:.16,depthWrite:false}));m.receiveShadow=false;
  const pts=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2],[-w/2,-d/2]].map(([a,b])=>new THREE.Vector3(x+a,.065,z+b));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineDashedMaterial({color,dashSize:.45,gapSize:.25}));line.computeLineDistances();scene.add(line);
}
function floorHeight(p){return .6*clamp((10-p.z)/3.4)}
function setupScene(){
  renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;container.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','三维物流场院：货车、07号月台、叉车及货物');
  controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-.025;controls.minDistance=12;controls.maxDistance=160;
  scene.add(new THREE.HemisphereLight(0xf6faff,0xbab09a,3));
  const sun=new THREE.DirectionalLight(0xfff6df,3.2);sun.position.set(-30,60,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-50,right:50,top:45,bottom:-45,near:1,far:150});sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff,.3));
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(500,500),new THREE.ShadowMaterial({opacity:.14}));ground.rotation.x=-Math.PI/2;ground.position.y=-.45;ground.receiveShadow=true;scene.add(ground);
  zone(DOCK_X,13,4.2,10,'#3b8b65');zone(15,18.4,6.6,9.5,'#c89335');
  label('07 号装卸位',[DOCK_X,5.6,8.6],5.8);label('分拨暂存区',[15,2.4,24.1],6,'#976d22');
  // A platform bridge and access ramp keep the forklift route off the dock edge.
  box(scene,[3.15,.12,2.35],[DOCK_X,.66,7.5],mats.steel);
  const ramp=new THREE.BufferGeometry();ramp.setAttribute('position',new THREE.Float32BufferAttribute([4.8,.6,6.6,7.2,.6,6.6,7.2,0,10,4.8,.6,6.6,7.2,0,10,4.8,0,10],3));ramp.computeVertexNormals();scene.add(new THREE.Mesh(ramp,new THREE.MeshStandardMaterial({color:'#9caaa0',side:THREE.DoubleSide})));
  setView('overview');new ResizeObserver(resize).observe(container);resize();
}
function resize(){if(!renderer)return;const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
function setView(view){if(!controls)return;const aspect=container.clientWidth/container.clientHeight;const presets={overview:{pos:aspect<1?[-82,80,135]:[-53,44,83],target:[0,6,7]},dock:{pos:[-13,20,40],target:[6,1.7,13]},top:{pos:[0,112,15],target:[0,0,7]}};const v=presets[view];camera.position.set(...v.pos);controls.target.set(...v.target);controls.update();document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('selected',b.dataset.view===view))}
let doors;
function renderState(){
  const s=sample(time);truck.position.set(s.truck.x,.01,s.truck.z);truck.rotation.y=s.truck.yaw;
  wheels.forEach(w=>w.rotation.x=s.truck.distance/.56);doors[0].rotation.y=-s.doors*Math.PI*.8;doors[1].rotation.y=s.doors*Math.PI*.8;
  const base=floorHeight(s.forklift);forklift.position.set(s.forklift.x,base+.01,s.forklift.z);forklift.rotation.y=s.forklift.yaw;forks.position.y=Math.max(.12,s.loadHeight-base);
  forkWheels.forEach(w=>w.rotation.x=s.forklift.distance/.34);
  const cutaway=$('#cutaway').checked;cutawayParts[0].material.transparent=cutaway;cutawayParts[0].material.opacity=cutaway?.2:1;cutawayParts[0].material.depthWrite=!cutaway;cutawayParts[2].visible=!cutaway;
  for(const p of s.pallets){const mesh=pallets[p.id];if(p.mode==='truck'){const v=new THREE.Vector3(0,1.19,-3.2+p.slot*1.65);v.applyAxisAngle(new THREE.Vector3(0,1,0),s.truck.yaw).add(truck.position);mesh.position.copy(v);mesh.rotation.y=s.truck.yaw}else if(p.mode==='carried'){mesh.position.set(s.forklift.x+Math.sin(s.forklift.yaw)*2.55,s.loadHeight+.07,s.forklift.z+Math.cos(s.forklift.yaw)*2.55);mesh.rotation.y=s.forklift.yaw}else{mesh.position.set(14.55,.07,16+p.id*2.5);mesh.rotation.y=Math.PI/2}}
  if(lastTitle!==s.title){$('#phase-title').textContent=s.title;$('#phase-detail').textContent=s.detail;lastTitle=s.title}
  $('#count').textContent=s.completed;$('#dock-status').textContent=s.dockBusy?'作业中':'空闲';$('#forklift-status').textContent=s.action;
  $('#run-badge').textContent=s.done?'已完成':playing?'运行中':'已暂停';$('#play').textContent=s.done?'再次演示':playing?'暂停作业':time>0?'继续作业':'开始作业';$('#play').setAttribute('aria-pressed',String(playing));
  $('#timeline').value=time;$('#clock').textContent=format(time)+' / '+format(TOTAL);
  const active=s.done?5:s.phase==='arrive'?0:s.phase==='reverse'?1:s.phase==='open'?2:s.phase.startsWith('unload')?3:4;
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
  setupScene();doors=makeTruck();makeForklift();for(let i=0;i<3;i++)pallets.push(makePallet(i));
  const gltf=await new GLTFLoader().loadAsync('./logistics-building.glb');
  const remove=[];gltf.scene.traverse(obj=>{if(/Vehicle[_ ]0[34]/.test(obj.name))remove.push(obj);if(obj.isMesh){obj.castShadow=true;obj.receiveShadow=true;if(obj.material.map)obj.material.map.anisotropy=4}});
  remove.forEach(obj=>obj.removeFromParent());scene.add(gltf.scene);
  ready=true;$('#load-status').textContent='场景已就绪 · 07 号月台';$('#loading').hidden=true;
  for(const id of ['play','reset','next','timeline'])$('#'+id).disabled=false;
  renderState();requestAnimationFrame(frame);
}catch(error){console.error(error);$('#load-status').textContent='场景加载失败';$('#loading').textContent='无法加载 3D 场景。请检查浏览器 WebGL 支持及本地文件，或打开右上角的静态建筑预览。'}

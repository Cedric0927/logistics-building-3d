import * as THREE from 'three';
import {lightingProfile} from './light-cycle.mjs';

export function createLighting(scene,renderer,stage){
  const fixtures=new THREE.Group();fixtures.name='DayNightFixtures';scene.add(fixtures);
  const artificial=[],emissions=[],windows=[],lightMaterials=new Set();
  const hemisphere=new THREE.HemisphereLight(0xf6faff,0xbab09a,3);scene.add(hemisphere);
  const sun=new THREE.DirectionalLight(0xfff6df,3.2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-50,right:50,top:45,bottom:-45,near:1,far:150});sun.shadow.bias=-.0002;sun.shadow.normalBias=.035;sun.target.position.set(0,0,4);scene.add(sun,sun.target);
  const ambient=new THREE.AmbientLight(0xffffff,.3),moon=new THREE.DirectionalLight(0x9db9ed,0);moon.position.set(22,45,-16);scene.add(ambient,moon);
  const steel=new THREE.MeshStandardMaterial({color:0x39464c,metalness:.65,roughness:.42});
  function body(size,pos,material,parent=fixtures){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),material);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
  function glow(size,pos,color,parent=fixtures){const mat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:0,roughness:.35});emissions.push(mat);return body(size,pos,mat,parent)}
  function powered(light,power){artificial.push({light,power});light.intensity=0;return light}
  // Under-canopy strips; six shared pools light the twelve loading bays.
  for(let i=0;i<12;i++){
    const x=-25.3+i*4.42;body([2.4,.09,.19],[x,4.28,7.83],steel);glow([2.22,.025,.15],[x,4.225,7.83],0xffdda2);
    if(i%2===0){const p=powered(new THREE.PointLight(0xffddac,0,13,2),85);p.position.set(x,4.0,7.8);fixtures.add(p)}
  }
  // Two yard lights, mounted on real poles with broad downward beams.
  for(const side of [-1,1]){
    const x=side*33,z=23;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.075,.13,10.8,10),steel);pole.position.set(x,5.4,z);pole.castShadow=true;fixtures.add(pole);
    body([.55,.12,.55],[x,.08,z],steel);body([2,.10,.12],[x-side*.9,10.8,z],steel);
    body([1.15,.17,.65],[x-side*1.7,10.75,z],steel);glow([.96,.025,.49],[x-side*1.7,10.65,z],0xffebc6);
    const spot=powered(new THREE.SpotLight(0xffebcc,0,43,.85,.68,2),500);spot.position.set(x-side*1.7,10.57,z);spot.target.position.set(side*19,0,12);fixtures.add(spot,spot.target);
  }
  // Selected office windows: glass remains behind the original blue frames.
  const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;
  const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,0,128);gradient.addColorStop(0,'#fff4d5');gradient.addColorStop(1,'#b98a4d');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,128);ctx.fillStyle='#7c694c45';for(let y=13;y<128;y+=15)ctx.fillRect(0,y,64,2);
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const winMat=new THREE.MeshBasicMaterial({map:tex,transparent:true,opacity:0,depthWrite:false});
  for(const [row,y] of [6.6,10.05,13.5].entries())for(let col=0;col<13;col++)if((col+row*2)%3===0){
    const pane=new THREE.Mesh(new THREE.PlaneGeometry(1.52,1.88),winMat);pane.position.set(-24.8+col*4.13,y,6.182);fixtures.add(pane);windows.push(pane);
  }
  let lastHour=NaN;
  function bindTruck(root){
    for(const x of [-1.02,1.02]){
      const spot=powered(new THREE.SpotLight(0xfff0d4,0,24,.42,.64,2),130);spot.position.set(x,1.52,4.43);spot.target.position.set(x,.04,17);root.add(spot,spot.target);
    }
    root.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])if(/Headlamp lenses|LED daytime lamps|Red tail lenses|Amber marker lamps/.test(m.name))lightMaterials.add(m)});
    lastHour=NaN;
  }
  function bindConveyor(root){
    const green=glow([.045,.035,.045],[1.17,1.52,5.76],0x48df94,root);green.castShadow=false;lastHour=NaN;
  }
  function setHour(hour){
    if(Number.isFinite(lastHour)&&Math.abs(hour-lastHour)<.0001)return;
    lastHour=hour;const p=lightingProfile(hour),theta=(p.hour-6)*Math.PI/12;
    sun.position.set(Math.cos(theta)*55,Math.sin(theta)*60,28);sun.intensity=p.sun;sun.color.set(p.sunColor);
    hemisphere.intensity=p.sky;hemisphere.color.set(0xf6faff).lerp(new THREE.Color(0x9fbbe8),p.lamps);hemisphere.groundColor.set(0xbab09a).lerp(new THREE.Color(0x394454),p.lamps);
    ambient.intensity=p.ambient;moon.intensity=.28*p.lamps;scene.environmentIntensity=p.environment;
    for(const {light,power} of artificial)light.intensity=power*p.lamps;
    for(const mat of emissions)mat.emissiveIntensity=3.2*p.lamps;
    for(const mat of lightMaterials){mat.emissive.copy(mat.color);mat.emissiveIntensity=(/Red|Amber/.test(mat.name)?1.5:2.8)*p.lamps+.05}
    winMat.opacity=.85*p.lamps;for(const pane of windows)pane.visible=p.lamps>.005;
    stage.style.setProperty('--sky-top',p.top);stage.style.setProperty('--sky-bottom',p.bottom);
    document.documentElement.dataset.night=p.lamps>.65?'true':'false';
    renderer.toneMappingExposure=1.05-.12*p.lamps;
    return p;
  }
  return {bindTruck,bindConveyor,setHour};
}

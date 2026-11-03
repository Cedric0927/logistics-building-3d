import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './vendor/three/build/three.module.js';
import {sample,TOTAL} from './simulation.mjs';
import {PERSON_ENTRY,PERSON_EXIT,BOOTH,UNDERBRIDGE_ROAD,BRIDGE_MIN_CLEARANCE,TRUCK_HEIGHT} from './circulation.mjs';

const raw=fs.readFileSync(new URL('./logistics-building.glb',import.meta.url));
const jsonBytes=raw.readUInt32LE(12),binStart=20+jsonBytes+8;
function accessor(index){const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView],size=a.type==='VEC3'?3:1,bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],stride=v.byteStride||size*bytes,view=new DataView(raw.buffer,raw.byteOffset+binStart),get={5126:'getFloat32',5125:'getUint32',5123:'getUint16',5121:'getUint8'}[a.componentType],out=[];for(let i=0;i<a.count;i++)for(let j=0;j<size;j++)out.push(view[get]((v.byteOffset||0)+(a.byteOffset||0)+i*stride+j*bytes,true));return out}
const gltf=JSON.parse(raw.toString('utf8',20,20+raw.readUInt32LE(12))),parts=[];
function walk(i,parent=new THREE.Matrix4()){
  const n=gltf.nodes[i],local=new THREE.Matrix4();
  if(n.matrix)local.fromArray(n.matrix);else local.compose(new THREE.Vector3(...(n.translation||[0,0,0])),new THREE.Quaternion(...(n.rotation||[0,0,0,1])),new THREE.Vector3(...(n.scale||[1,1,1])));
  const world=parent.clone().multiply(local);
  if(n.mesh!==undefined){const bounds=new THREE.Box3();for(const p of gltf.meshes[n.mesh].primitives){const a=gltf.accessors[p.attributes.POSITION];bounds.union(new THREE.Box3(new THREE.Vector3(...a.min),new THREE.Vector3(...a.max)).applyMatrix4(world))}const triangles=[];if(n.name.startsWith('Entrance'))for(const p of gltf.meshes[n.mesh].primitives){const pos=accessor(p.attributes.POSITION),ids=p.indices===undefined?Array.from({length:pos.length/3},(_,i)=>i):accessor(p.indices);for(let k=0;k<ids.length;k+=3)triangles.push(ids.slice(k,k+3).map(i=>new THREE.Vector3(...pos.slice(i*3,i*3+3)).applyMatrix4(world)))}parts.push({name:n.name.replaceAll('_',' '),bounds,triangles})}
  for(const c of n.children||[])walk(c,world);
}
for(const i of gltf.scenes[gltf.scene||0].nodes)walk(i);
const part=name=>{const p=parts.find(p=>p.name===name);assert(p,'Missing baked part: '+name);return p.bounds};
const overlaps=(x0,x1,z0,z1,b)=>x1>b.min.x&&x0<b.max.x&&z1>b.min.z&&z0<b.max.z;

test('booth and stair fronts align; people enter front then use internal left door',()=>{
  const booth=part('Entrance / booth front sidelights'),stair=part('Entrance / stair enclosure front panels');
  assert(Math.abs(booth.max.z-stair.max.z)<.15);
  assert.equal(BOOTH.frontZ,BOOTH.stairFrontZ);
  const front=PERSON_ENTRY.findIndex(p=>p[0]===BOOTH.frontDoor[0]&&p[2]<BOOTH.frontDoor[1]);
  const left=PERSON_ENTRY.findIndex(p=>p[0]<BOOTH.leftDoor[0]&&p[2]===BOOTH.leftDoor[1]);
  assert(front>=0&&left>front);
  // At standing height, actual door leaves, frames and booth walls leave the entry route open.
  const walls=parts.filter(p=>/Entrance \/ (guard booth glazing|booth.*(glazing|base|sidelights|posts)|front door jambs|internal left door jambs|.*open leaf|guard desk)/.test(p.name));
  for(let i=1;i<=left;i++){
    const a=new THREE.Vector3(PERSON_ENTRY[i-1][0],1,PERSON_ENTRY[i-1][2]),b=new THREE.Vector3(PERSON_ENTRY[i][0],1,PERSON_ENTRY[i][2]),dir=b.clone().sub(a),length=dir.length(),ray=new THREE.Ray(a,dir.normalize());
    for(const wall of walls)for(const tri of wall.triangles){const hit=ray.intersectTriangle(...tri,false,new THREE.Vector3());assert(!hit||hit.distanceTo(a)>length-1e-5||hit.distanceTo(a)<1e-5,'Entry path hits '+wall.name)}
  }
});

test('pedestrian ground paths stay outside the vehicle road and descending route uses exit cage',()=>{
  for(const path of [PERSON_ENTRY,PERSON_EXIT])for(let i=1;i<path.length;i++)for(let k=0;k<=20;k++){
    const a=new THREE.Vector3(...path[i-1]),p=a.lerp(new THREE.Vector3(...path[i]),k/20);
    if(p.z>=UNDERBRIDGE_ROAD.minZ&&p.z<=UNDERBRIDGE_ROAD.maxZ)assert(p.y>TRUCK_HEIGHT+.5,'Pedestrian route crosses road at grade');
  }
  const rotor=part('Entrance / one-way exit rotor');
  assert(PERSON_EXIT.some(p=>Math.hypot(p[0]-(rotor.min.x+rotor.max.x)/2,p[2]-(rotor.min.z+rotor.max.z)/2)<.7));
  assert(!PERSON_EXIT.some(p=>p[0]>-34&&p[2]<33.2&&p[2]>29.8));
});

test('truck passes under bridge with real-model height and pillar clearance',()=>{
  const beams=part('Bridge / longitudinal beam flanges'),piers=part('Bridge / concrete support piers');
  assert(Math.abs(beams.min.y-BRIDGE_MIN_CLEARANCE)<.01);
  assert(beams.min.y>TRUCK_HEIGHT+.30,'Insufficient bridge headroom');
  let passedUnder=false;
  for(let t=0;t<=TOTAL;t+=.025){
    const {truck}=sample(t),c=Math.abs(Math.cos(truck.yaw)),s=Math.abs(Math.sin(truck.yaw));
    const hx=c*1.82+s*4.51,hz=s*1.82+c*4.51;
    if(truck.x> -35.2&&truck.x< -30.8&&truck.z<20){passedUnder=true;assert(truck.z-hz>UNDERBRIDGE_ROAD.minZ&&truck.z+hz<UNDERBRIDGE_ROAD.maxZ)}
    // Piers share a batched mesh: test the individual rectangles rather than its enclosing box.
    for(const x of [-34.85,-31.15])for(const z of [10.5,22.8,28.8])assert(!(truck.x+hx>x-.275&&truck.x-hx<x+.275&&truck.z+hz>z-.30&&truck.z-hz<z+.30),'Truck hits bridge pier');
    for(const name of ['Entrance / stair enclosure front panels','Entrance / stair enclosure rear panels','Entrance / guard booth floor','Entrance / turnstile side partition'])assert(!overlaps(truck.x-hx,truck.x+hx,truck.z-hz,truck.z+hz,part(name)),'Truck overlaps '+name);
  }
  assert(passedUnder);assert(piers.min.y<.1);
});

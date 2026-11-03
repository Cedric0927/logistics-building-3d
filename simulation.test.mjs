import test from 'node:test';
import assert from 'node:assert/strict';
import {sample,nextPhase,PHASES,TOTAL,DOCK_X,CARGO_COUNT} from './simulation.mjs';

test('all cartons go from truck to belt to the indoor line with no yard storage',()=>{
  let previousCount=0;
  for(let t=0;t<=TOTAL;t+=.025){
    const s=sample(t);
    assert.equal(s.parcels.length,CARGO_COUNT);
    assert.equal(s.parcels.filter(p=>p.mode==='inside').length,s.completed);
    assert(s.completed>=previousCount);
    previousCount=s.completed;
    for(const p of s.parcels){
      assert(['truck','feeding','belt','inside'].includes(p.mode));
      if(['feeding','belt'].includes(p.mode)){assert.equal(s.doors,1);assert.equal(s.extension,1);assert.equal(s.truck.x,DOCK_X);assert.equal(s.truck.z,12.2)}
      if(p.mode==='belt'){assert.equal(p.x,DOCK_X);assert(p.z>=-1&&p.z<=12.45)}
    }
    if(s.phase==='retract'){assert.equal(s.completed,CARGO_COUNT);assert.equal(s.onBelt,0)}
    if(s.phase==='close'||s.phase==='depart')assert.equal(s.extension,0);
    if(s.extension>0)assert.equal(s.doors,1);
  }
  assert.equal(sample(TOTAL).completed,CARGO_COUNT);
  assert.equal(sample(TOTAL).done,true);
  assert.equal(sample(TOTAL).dockBusy,false);
  assert.equal(sample(TOTAL).doors,0);
});
test('truck and extension are continuous at phase boundaries',()=>{
  for(const p of PHASES.slice(1)){
    const a=sample(p.start-.00001),b=sample(p.start);
    assert(Math.hypot(a.truck.x-b.truck.x,a.truck.z-b.truck.z)<.001,`Truck jumps at ${p.id}`);
    assert(Math.abs(a.extension-b.extension)<.001);
  }
});
test('cartons move inward along belt and rewinding restores full cargo',()=>{
  for(let i=0;i<CARGO_COUNT;i++){
    const start=28+i*1.8+1.2;
    const a=sample(start+.01).parcels[i],b=sample(start+3).parcels[i];
    assert.equal(a.mode,'belt');assert.equal(b.mode,'belt');assert(b.z<a.z);
  }
  const initial=sample(0);sample(TOTAL);
  assert.deepEqual(sample(0),initial);
  assert.equal(nextPhase(22),28);
  assert.equal(nextPhase(TOTAL),TOTAL);
  assert.equal(sample(-10).time,0);
  assert.equal(sample(TOTAL+10).time,TOTAL);
});

test('truck footprint clears the central bridge and stair envelope',()=>{
  // Bridge occupies x <= -30.84. Include the complete rotating 9m box truck footprint.
  for(let t=0;t<=TOTAL;t+=.05){
    const {truck}=sample(t);
    const halfX=Math.abs(Math.cos(truck.yaw))*1.27+Math.abs(Math.sin(truck.yaw))*4.5;
    assert(truck.x-halfX> -30.84,'Truck intersects pedestrian bridge at '+t);
  }
});

test('departing truck clears new east-yard entrance barriers',()=>{
  // The nearest yellow block begins at x=39.5; check full truck body at every phase.
  for(let t=0;t<=TOTAL;t+=.05){
    const {truck}=sample(t);
    const halfX=Math.abs(Math.cos(truck.yaw))*1.5+Math.abs(Math.sin(truck.yaw))*4.6;
    assert(truck.x+halfX<39.5,'Truck intersects east-yard entrance at '+t);
  }
});

test('inbound truck uses the booth drive-through and clears entrance furniture',()=>{
  assert.equal(sample(0).truck.x,-23);assert.equal(sample(0).truck.z,56);
  const obstacles=[
    {name:'guard booth',x0:-31.2,x1:-27.2,z0:31.4,z1:34.6},
    {name:'raised barrier base',x0:-27.08,x1:-26.62,z0:31.05,z1:31.55},
    {name:'folded gate',x0:-19.08,x1:-18.92,z0:32.9,z1:37.3},
    {name:'east parking canopy',x0:-13.1,x1:-4.9,z0:34.9,z1:59.1},
    {name:'west parking canopy',x0:-55.1,x1:-44.9,z0:30.9,z1:59.1}
  ];
  for(let t=0;t<=10;t+=.025){
    const {truck}=sample(t),c=Math.abs(Math.cos(truck.yaw)),s=Math.abs(Math.sin(truck.yaw));
    const hx=c*1.5+s*4.6,hz=s*1.5+c*4.6;
    for(const o of obstacles)assert(truck.x+hx<o.x0||truck.x-hx>o.x1||truck.z+hz<o.z0||truck.z-hz>o.z1,'Truck overlaps '+o.name+' at '+t);
  }
});

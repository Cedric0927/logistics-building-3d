import test from 'node:test';
import assert from 'node:assert/strict';
import {sample,nextPhase,PHASES,TOTAL,DOCK_X} from './simulation.mjs';

test('unloading conserves three pallets and requires stationary truck with open doors',()=>{
  let previousCount=0;
  for(let t=0;t<=TOTAL;t+=.05){
    const s=sample(t);
    assert.equal(s.pallets.length,3);
    assert.equal(s.pallets.filter(p=>p.mode==='sorted').length,s.completed);
    assert(s.completed>=previousCount);
    previousCount=s.completed;
    assert(s.pallets.filter(p=>p.mode==='carried').length<=1);
    if(s.pallets.some(p=>p.mode==='carried')){assert.equal(s.doors,1);assert.equal(s.truck.x,DOCK_X);assert.equal(s.truck.z,12.2)}
  }
  assert.equal(sample(TOTAL).completed,3);
  assert.equal(sample(TOTAL).done,true);
  assert.equal(sample(TOTAL).dockBusy,false);
  assert.equal(sample(TOTAL).doors,0);
});
test('truck and forklift do not jump at timeline boundaries',()=>{
  for(const p of PHASES.slice(1)){
    const a=sample(p.start-.00001),b=sample(p.start);
    for(const name of ['truck','forklift'])assert(Math.hypot(a[name].x-b[name].x,a[name].z-b[name].z)<.001,`${name} jumps at ${p.id}`);
  }
});
test('rewinding restores initial cargo, controls stop at completion',()=>{
  const initial=sample(0);
  sample(65);sample(TOTAL);
  assert.deepEqual(sample(0),initial);
  assert.equal(nextPhase(0),10);
  assert.equal(nextPhase(22),42);
  assert.equal(nextPhase(TOTAL),TOTAL);
  assert.equal(sample(-10).time,0);
  assert.equal(sample(TOTAL+10).time,TOTAL);
});

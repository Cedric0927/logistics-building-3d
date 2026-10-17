import test from 'node:test';
import assert from 'node:assert/strict';
import {lightingProfile,formatHour} from './light-cycle.mjs';
test('night activates fixtures while daytime has strong natural light',()=>{
  const day=lightingProfile(12),dusk=lightingProfile(18.3),night=lightingProfile(22);
  assert.equal(day.lamps,0);assert.equal(night.lamps,1);assert(dusk.lamps>0&&dusk.lamps<1);
  assert(day.sun>dusk.sun&&dusk.sun>night.sun);assert(day.environment>night.environment);
  assert(night.sky>0&&night.ambient>0,'Night must remain navigable');
});
test('a full day wraps without a midnight jump and has bounded continuous output',()=>{
  assert.deepEqual(lightingProfile(0),lightingProfile(24));
  assert.deepEqual(lightingProfile(-2),lightingProfile(22));
  for(let h=0;h<24;h+=.02){const a=lightingProfile(h),b=lightingProfile(h+.00001);assert(a.lamps>=0&&a.lamps<=1);assert(a.sun>=0);assert(Math.abs(a.lamps-b.lamps)<.001);assert(Math.abs(a.sun-b.sun)<.001);assert(/^#[0-9a-f]{6}$/.test(a.top))}
  assert.equal(formatHour(18.3),'18:18');
});

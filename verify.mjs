import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const files=['index.html','serve.mjs','package.json','logistics-building.glb','logistics-building.blend','reference.jpg','building-preview.png','building-info.json','create-building.py','facade-tiles.png','glass-reflection.png','vendor/model-viewer.min.js','vendor/LICENSE-model-viewer'];
const root=new URL('.',import.meta.url);
const hashes={};
for(const file of files){
  const data=await readFile(new URL(file,root));
  assert(data.length>0,`Empty file: ${file}`);
  hashes[file]=createHash('sha256').update(data).digest('hex');
}
if(process.argv.includes('--update')){
  await writeFile(new URL('asset-manifest.json',root),JSON.stringify(hashes,null,2)+'\n');
  console.log('Asset manifest updated.');
}
const expected=JSON.parse(await readFile(new URL('asset-manifest.json',root),'utf8'));
assert.deepEqual(hashes,expected,'Asset hashes differ from the published version.');
const glb=await readFile(new URL('logistics-building.glb',root));
assert.equal(glb.toString('ascii',0,4),'glTF');
assert.equal(glb.readUInt32LE(4),2);
assert.equal(glb.readUInt32LE(8),glb.length);
const json=JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)));
assert(json.meshes.length>0,'No meshes found');
assert(json.images.length>0,'No textures found');
for(const image of json.images)assert(Number.isInteger(image.bufferView)&&!image.uri,'Texture must be embedded');
for(const buffer of json.buffers)assert(!buffer.uri,'Buffer must be embedded');
const html=await readFile(new URL('index.html',root),'utf8');
for(const match of html.matchAll(/(?:src|href)="(\.\/[^"#]+)"/g))await readFile(new URL(match[1],root));
for(const match of html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g))new Function(match[1]);
assert(!/\bsrc="https?:\/\//i.test(html),'Runtime dependencies must be local');
console.log(`Verified ${files.length} assets; GLB ${glb.length} bytes, ${json.meshes.length} meshes, ${json.images.length} embedded textures.`);

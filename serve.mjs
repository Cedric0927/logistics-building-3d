import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const port=Number(process.env.PORT || 4176);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be an integer between 1 and 65535');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.blend':'application/octet-stream','.md':'text/plain; charset=utf-8'};
createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!path.startsWith(root.endsWith(sep)?root:root+sep)){res.writeHead(403);return res.end('Forbidden')}if(!(await stat(path)).isFile())throw Error('Not a file');const data=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}}).listen(port,'127.0.0.1',()=>console.log(`http://127.0.0.1:${port}`));

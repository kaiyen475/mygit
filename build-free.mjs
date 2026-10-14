import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, rmSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('.', import.meta.url));
const read = name => readFileSync(path.join(root,name),'utf8');
const source = stripTypeScriptTypes(read('app/api/service.ts'), {mode:'transform',sourceMap:false});
const html = read('public/index.html');
const browser = read('public/app.js');
const css = read('public/styles.css');
const forest = read('public/forest.svg');
const entry = source + '\n' + `
const assets = ${JSON.stringify({'/':{body:html,type:'text/html; charset=utf-8'},'/index.html':{body:html,type:'text/html; charset=utf-8'},'/app.js':{body:browser,type:'text/javascript; charset=utf-8'},'/styles.css':{body:css,type:'text/css; charset=utf-8'},'/forest.svg':{body:forest,type:'image/svg+xml'}})};
export default {
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/api/admin/login' && request.method === 'POST') return api(request,'login');
    if (path === '/api/admin/logout' && request.method === 'POST') return api(request,'logout');
    if (path === '/api/expeditions') {
      if (request.method === 'GET') return api(request,'list');
      if (request.method === 'POST') return api(request,'save');
    }
    const match = path.match(/^\\/api\\/expeditions\\/([^/]+)(\\/apply)?$/);
    if (match) {
      let id; try { id=decodeURIComponent(match[1]); } catch { return new Response('Invalid path',{status:400}); }
      if (match[2] && request.method === 'POST') return api(request,'apply',id);
      if (!match[2] && request.method === 'GET') return api(request,'detail',id);
      if (!match[2] && request.method === 'PUT') return api(request,'save',id);
    }
    if (path.startsWith('/api/')) return new Response(JSON.stringify({error:'지원하지 않는 요청입니다.'}),{status:404,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
    const asset=assets[path];
    if (asset && (request.method === 'GET'||request.method === 'HEAD')) return new Response(request.method==='HEAD'?null:asset.body,{headers:{'Content-Type':asset.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
    return new Response('Not found',{status:404});
  }
};
`;
if(existsSync(path.join(root,'dist'))) rmSync(path.join(root,'dist'),{recursive:true});
mkdirSync(path.join(root,'dist/server'),{recursive:true});
mkdirSync(path.join(root,'dist/.openai'),{recursive:true});
writeFileSync(path.join(root,'dist/server/index.js'),entry);
cpSync(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
cpSync(path.join(root,'drizzle'),path.join(root,'dist/.openai/drizzle'),{recursive:true});
console.log('Dependency-free Worker built: dist/server/index.js');
const forestUri = 'data:image/svg+xml;base64,' + Buffer.from(forest).toString('base64');
const inlineBrowser = browser.replaceAll('forest.svg', forestUri).replaceAll('</script','<\\/script');
const preview = html
  .replace(/<link rel="stylesheet" href="[^"]+">/,()=>'<style>'+css+'</style>')
  .replace(/<script defer src="[^"]+"><\/script>/,'')
  .replace('</body>',()=>'<script>'+inlineBrowser+'</script></body>');
writeFileSync(path.join(root,'preview.html'),preview);
console.log('Standalone screen preview built: preview.html');

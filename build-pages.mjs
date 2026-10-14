import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const output=path.join(root,'.sites-runtime/pages');
mkdirSync(output,{recursive:true});
let html;
if(existsSync(path.join(root,'deployment.json'))){
  const config=JSON.parse(readFileSync(path.join(root,'deployment.json'),'utf8'));
  const url=new URL(config.url);
  if(url.protocol!=='https:'||!/^vitall-field-notes\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname)||url.username||url.password) throw new Error('실제 사이트 주소를 확인해 주세요.');
  const destination=url.origin+'/';
  html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${destination}"><link rel="canonical" href="${destination}"><title>VITALL · 함께 만나는 자연</title><style>body{margin:0;background:#f8f9f4;color:#244c3c;font-family:system-ui,sans-serif;display:grid;min-height:100vh;place-items:center}main{text-align:center;padding:32px}h1{letter-spacing:-1px;font-size:40px}p{color:#64705f}a{display:inline-block;background:#244c3c;color:white;padding:14px 24px;text-decoration:none;border-radius:5px}</style></head><body><main><h1>VITALL</h1><p>탐사 게시판으로 이동합니다.</p><a href="${destination}">탐사 게시판 열기</a></main></body></html>`;
  console.log('GitHub Pages connects to the live VITALL application.');
}else{
  html=readFileSync(path.join(root,'preview.html'),'utf8');
  console.log('GitHub Pages displays the screen preview.');
}
writeFileSync(path.join(output,'index.html'),html);
writeFileSync(path.join(output,'.nojekyll'),'');

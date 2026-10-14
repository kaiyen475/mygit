import { env } from 'cloudflare:workers';

type Bindings = { DB: D1Database; ADMIN_PASSWORD?: string };
const bindings = () => env as unknown as Bindings;
const db = () => bindings().DB;
const categories = ['조류','식물','습지','곤충','기타'];
const cookieName = 'vitall_admin';
const sessionSeconds = 8 * 60 * 60;
type Row = Record<string, any>;

const examples = [
  {id:'example-birds', title:'가을 철새를 만나는 미호강 탐사', category:'조류', date:'2026-10-24T00:00:00.000Z', deadline:'2026-10-23T09:00:00.000Z', location:'청주 미호강 일대', description:'미호강을 따라 걸으며 가을 철새의 움직임을 관찰합니다. 처음 탐조를 시작하는 분도 함께할 수 있어요.\n\n준비물: 편한 복장, 물, 개인 관찰 도구\n쌍안경이 없다면 대여를 선택해 주세요.\n\n이 게시물은 화면 안내를 위한 예시입니다. 실제 탐사 일정은 운영자가 등록합니다.', meetingPlaces:['충북대학교 정문','미호강 현장 집합'], capacity:20, status:'open',isExample:true,count:0},
  {id:'example-plants', title:'숲의 계절을 읽는 상당산성 식물 탐사', category:'식물',date:'2026-11-07T01:00:00.000Z',deadline:'2026-11-06T09:00:00.000Z',location:'청주 상당산성',description:'숲길의 잎과 열매를 살펴보고, 식물의 겨울 준비를 관찰합니다. 천천히 걷고 함께 기록하는 탐사입니다.\n\n준비물: 걷기 편한 신발, 물, 작은 기록장\n\n이 게시물은 화면 안내를 위한 예시입니다. 실제 탐사 일정은 운영자가 등록합니다.',meetingPlaces:['충북대학교 정문','상당산성 주차장'],capacity:15,status:'open',isExample:true,count:0},
  {id:'example-wetland',title:'물과 생명이 만나는 대청호 습지 탐사',category:'습지',date:'2026-10-03T00:00:00.000Z',deadline:'2026-10-02T09:00:00.000Z',location:'대청호 주변 습지',description:'습지에 사는 생물과 주변의 생태를 함께 살펴보는 탐사 기록입니다.\n\n이 게시물은 지난 탐사 화면을 보여주기 위한 예시입니다.',meetingPlaces:['충북대학교 정문','대청호 현장 집합'],capacity:20,status:'closed',isExample:true,count:0},
];

class HttpError extends Error { constructor(public status:number, message:string){super(message);} }
const json = (body:unknown, status=200, extra:Record<string,string>={}) => new Response(JSON.stringify(body), {status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...extra}});
async function digest(value:string) { const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); return Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join(''); }
async function currentAdmin(req:Request) {
  const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  const row=await db().prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').bind(await digest(token)).first<{expires_at:number}>();
  return !!row && row.expires_at > Date.now();
}
async function requireAdmin(req:Request) { if(!await currentAdmin(req)) throw new HttpError(401,'운영자 비밀번호를 먼저 입력해 주세요.'); }
async function body(req:Request) {
  const origin=req.headers.get('origin');
  if(origin && origin !== new URL(req.url).origin) throw new HttpError(403,'허용되지 않은 요청입니다.');
  if(!req.headers.get('content-type')?.includes('application/json')) throw new HttpError(415,'JSON 형식으로 요청해 주세요.');
  const raw=await req.text(); if(raw.length>16000) throw new HttpError(413,'입력 내용이 너무 깁니다.');
  try {const value=JSON.parse(raw); if(!value || typeof value!=='object' || Array.isArray(value)) throw 0; return value;} catch {throw new HttpError(400,'입력 내용을 확인해 주세요.');}
}
function string(value:unknown, label:string, min=1, max=200) { if(typeof value!=='string' || value.trim().length<min || value.trim().length>max) throw new HttpError(400,`${label}을(를) 확인해 주세요.`); return value.trim(); }
function mapEvent(r:Row){return {id:r.id,title:r.title,category:r.category,date:r.date,deadline:r.deadline,location:r.location,description:r.description,meetingPlaces:JSON.parse(r.meeting_places),capacity:r.capacity,status:r.status,isExample:!!r.is_example,count:Number(r.count||0)};}
async function eventRows() {const rows=await db().prepare('SELECT e.*, (SELECT COUNT(*) FROM applicants a WHERE a.event_id=e.id) AS count FROM expeditions e ORDER BY e.date DESC').all<Row>();return rows.results.map(mapEvent);}
async function eventById(id:string) {
  const row=await db().prepare('SELECT e.*, (SELECT COUNT(*) FROM applicants a WHERE a.event_id=e.id) AS count FROM expeditions e WHERE e.id=?').bind(id).first<Row>();
  if(row) return mapEvent(row);
  const example=examples.find(e=>e.id===id); if(example) return example;
  throw new HttpError(404,'탐사 게시물을 찾을 수 없습니다.');
}
function eventInput(b:Row) {
  const title=string(b.title,'제목',2,120),category=string(b.category,'카테고리');
  if(!categories.includes(category)) throw new HttpError(400,'카테고리를 선택해 주세요.');
  const date=new Date(string(b.date,'탐사 일시')),deadline=new Date(string(b.deadline,'신청 마감'));
  if(!Number.isFinite(date.getTime())||!Number.isFinite(deadline.getTime())||deadline>date) throw new HttpError(400,'신청 마감은 탐사 일시 이전으로 설정해 주세요.');
  const location=string(b.location,'탐사 장소',1,200),description=string(b.description,'탐사 안내',1,8000);
  if(!Array.isArray(b.meetingPlaces) || !b.meetingPlaces.length || b.meetingPlaces.length>12) throw new HttpError(400,'집합 장소를 1개 이상 입력해 주세요.');
  const meetingPlaces=[...new Set(b.meetingPlaces.map((p:unknown)=>string(p,'집합 장소',1,150)))];
  const capacity=Number(b.capacity); if(!Number.isInteger(capacity)||capacity<0||capacity>10000) throw new HttpError(400,'정원은 0에서 10000 사이로 입력해 주세요.');
  if(!['open','closed'].includes(b.status)) throw new HttpError(400,'모집 상태를 선택해 주세요.');
  return {title,category,date:date.toISOString(),deadline:deadline.toISOString(),location,description,meetingPlaces,capacity,status:b.status,isExample:!!b.isExample};
}

export async function api(req:Request, action:string, id?:string):Promise<Response> {
  try {
    if(!db()) throw new HttpError(503,'저장소 연결을 준비 중입니다. 잠시 후 다시 시도해 주세요.');
    if(action==='login') {
      const b=await body(req),password=string(b.password,'비밀번호',1,200),secret=bindings().ADMIN_PASSWORD;
      if(!secret) throw new HttpError(503,'운영자 비밀번호가 설정되지 않았습니다.');
      const key=await digest(req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'shared'),now=Date.now();
      const attempt=await db().prepare('SELECT failures, window_start FROM login_attempts WHERE key=?').bind(key).first<{failures:number,window_start:number}>();
      if(attempt && now-attempt.window_start<900000 && attempt.failures>=10) throw new HttpError(429,'입력 시도가 많습니다. 15분 뒤 다시 시도해 주세요.');
      const a=await digest(password),bHash=await digest(secret);let mismatch=0;for(let i=0;i<a.length;i++) mismatch|=a.charCodeAt(i)^bHash.charCodeAt(i);
      if(mismatch) {
        await db().prepare('INSERT INTO login_attempts (key, failures, window_start) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN ?-window_start>=900000 THEN 1 ELSE failures+1 END, window_start=CASE WHEN ?-window_start>=900000 THEN ? ELSE window_start END').bind(key,now,now,now,now).run();
        throw new HttpError(401,'비밀번호가 일치하지 않습니다.');
      }
      const bytes=crypto.getRandomValues(new Uint8Array(32)),token=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
      await db().batch([db().prepare('DELETE FROM admin_sessions WHERE expires_at < ?').bind(now),db().prepare('DELETE FROM login_attempts WHERE key=?').bind(key),db().prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?,?)').bind(await digest(token),now+sessionSeconds*1000)]);
      return json({success:true},200,{'Set-Cookie':`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds}${new URL(req.url).protocol==='https:'?'; Secure':''}`});
    }
    if(action==='logout') {
      await body(req);
      const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
      if(token) await db().prepare('DELETE FROM admin_sessions WHERE token_hash=?').bind(await digest(token)).run();
      return json({success:true},200,{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Secure`});
    }
    if(action==='list' && req.method==='GET') {const events=await eventRows();return json({events:events.length?events:examples,admin:await currentAdmin(req)});}
    if(action==='detail' && req.method==='GET' && id) {
      const event=await eventById(id),admin=await currentAdmin(req);
      const signedUp=event.isExample?[]:(await db().prepare('SELECT name FROM applicants WHERE event_id=? ORDER BY created_at, id').bind(id).all<{name:string}>()).results;
      if(!admin) return json({event,signedUp,admin:false});
      const rows=event.isExample?[]:(await db().prepare('SELECT id,name,phone,binoculars,boots,meeting_place,meal,created_at FROM applicants WHERE event_id=? ORDER BY created_at,id').bind(id).all<Row>()).results;
      return json({event,signedUp,admin:true,applicants:rows.map(r=>({id:r.id,name:r.name,phone:r.phone,binoculars:!!r.binoculars,boots:!!r.boots,meetingPlace:r.meeting_place,meal:!!r.meal,createdAt:r.created_at}))});
    }
    if(action==='save') {
      await requireAdmin(req);const b=await body(req),e=eventInput(b),eventId=id&&!id.startsWith('example-')?id:crypto.randomUUID();
      if(req.method==='PUT'&&id) {
        const old=await eventById(id);
        if(e.capacity>0&&e.capacity<old.count) throw new HttpError(400,'정원을 현재 신청 인원보다 적게 설정할 수 없습니다.');
      }
      const saved=await db().prepare('INSERT INTO expeditions (id,title,category,date,deadline,location,description,meeting_places,capacity,status,is_example,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,category=excluded.category,date=excluded.date,deadline=excluded.deadline,location=excluded.location,description=excluded.description,meeting_places=excluded.meeting_places,capacity=excluded.capacity,status=excluded.status,is_example=excluded.is_example WHERE (excluded.capacity=0 OR excluded.capacity >= (SELECT COUNT(*) FROM applicants WHERE event_id=expeditions.id)) AND NOT EXISTS (SELECT 1 FROM applicants a WHERE a.event_id=expeditions.id AND NOT EXISTS (SELECT 1 FROM json_each(excluded.meeting_places) p WHERE p.value=a.meeting_place))').bind(eventId,e.title,e.category,e.date,e.deadline,e.location,e.description,JSON.stringify(e.meetingPlaces),e.capacity,e.status,e.isExample?1:0,new Date().toISOString()).run();
      if(!saved.meta.changes) throw new HttpError(409,'신청 현황이 변경되었습니다. 정원과 신청자가 선택한 집합 장소를 확인해 주세요.');
      return json({success:true,event:await eventById(eventId)},req.method==='POST'?201:200);
    }
    if(action==='apply' && id) {
      const b=await body(req),event=await eventById(id),name=string(b.name,'이름',1,50);
      const phone=string(b.phone,'전화번호',8,30).replace(/[\s()+.-]/g,'');
      if(!/^0\d{8,10}$/.test(phone)) throw new HttpError(400,'전화번호를 올바르게 입력해 주세요.');
      if(typeof b.binoculars!=='boolean'||typeof b.boots!=='boolean'||typeof b.meal!=='boolean') throw new HttpError(400,'대여 여부와 식사 여부를 선택해 주세요.');
      if(b.consent!==true) throw new HttpError(400,'개인정보 수집 안내에 동의해 주세요.');
      const meetingPlace=string(b.meetingPlace,'집합 장소',1,150),key=string(b.idempotencyKey,'신청 식별값',8,100);
      if(!event.meetingPlaces.includes(meetingPlace)) throw new HttpError(400,'등록된 집합 장소를 선택해 주세요.');
      const previousApplication=()=>db().prepare('SELECT event_id,name,phone,binoculars,boots,meeting_place,meal FROM applicants WHERE idempotency_key=?').bind(key).first<Row>();
      const sameApplication=(r:Row)=>r.event_id===id&&r.name===name&&r.phone===phone&&Number(r.binoculars)===(b.binoculars?1:0)&&Number(r.boots)===(b.boots?1:0)&&r.meeting_place===meetingPlace&&Number(r.meal)===(b.meal?1:0);
      const prior=await previousApplication();
      if(prior) {if(!sameApplication(prior)) throw new HttpError(409,'신청 정보를 다시 확인해 주세요.');return json({success:true,name,count:(await eventById(id)).count});}
      const now=new Date().toISOString();
      if(event.isExample) throw new HttpError(400,'예시 탐사에는 신청할 수 없습니다. 실제 탐사 공지를 기다려 주세요.');
      if(event.status!=='open'||event.deadline<=now||event.date<=now) throw new HttpError(409,'신청이 마감된 탐사입니다.');
      const duplicate=await db().prepare('SELECT id FROM applicants WHERE event_id=? AND name=? AND phone=?').bind(id,name,phone).first();
      if(duplicate) {
        const retry=await previousApplication();
        if(retry&&sameApplication(retry)) return json({success:true,name,count:(await eventById(id)).count});
        throw new HttpError(409,'동일한 이름과 전화번호로 이미 신청하셨습니다.');
      }
      try {
        const result=await db().prepare('INSERT INTO applicants (id,event_id,name,phone,binoculars,boots,meeting_place,meal,idempotency_key,created_at) SELECT ?,id,?,?,?,?,?,?,?,? FROM expeditions WHERE id=? AND status=\'open\' AND is_example=0 AND deadline>? AND date>? AND (capacity=0 OR (SELECT COUNT(*) FROM applicants WHERE event_id=?)<capacity) AND EXISTS (SELECT 1 FROM json_each(expeditions.meeting_places) p WHERE p.value=?)').bind(crypto.randomUUID(),name,phone,b.binoculars?1:0,b.boots?1:0,meetingPlace,b.meal?1:0,key,now,id,now,now,id,meetingPlace).run();
        if(!result.meta.changes) throw new HttpError(409,'신청이 마감되었거나 정원 또는 집합 장소가 변경되었습니다.');
      } catch(err) {
        const retry=await previousApplication();
        if(!retry||!sameApplication(retry)) {
          if(err instanceof HttpError) throw err;
          throw new HttpError(409,'이미 신청되었거나 저장 중 문제가 생겼습니다. 신청 현황을 확인해 주세요.');
        }
      }
      return json({success:true,name,count:(await eventById(id)).count},201);
    }
    throw new HttpError(405,'지원하지 않는 요청입니다.');
  } catch(error) {if(error instanceof HttpError) return json({error:error.message},error.status); console.error('VITALL API request failed', error instanceof Error?error.message:'unknown');return json({error:'처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'},500);}
}

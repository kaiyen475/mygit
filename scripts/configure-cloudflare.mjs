import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const required = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_D1_DATABASE_ID', 'ADMIN_PASSWORD'];
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {
  throw new Error(`GitHub 설정이 필요합니다: ${missing.join(', ')}`);
}
if (!/^[a-f0-9]{32}$/i.test(process.env.CLOUDFLARE_ACCOUNT_ID.trim())) {
  throw new Error('CLOUDFLARE_ACCOUNT_ID에는 Cloudflare의 32자리 Account ID를 입력하세요.');
}
if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(process.env.CLOUDFLARE_D1_DATABASE_ID.trim())) {
  throw new Error('CLOUDFLARE_D1_DATABASE_ID에는 생성한 D1의 Database ID를 입력하세요.');
}

const config = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
config.main = '../dist/server/index.js';
config.account_id = process.env.CLOUDFLARE_ACCOUNT_ID.trim();
config.d1_databases[0].database_id = process.env.CLOUDFLARE_D1_DATABASE_ID.trim();
config.d1_databases[0].migrations_dir = '../drizzle';
const runtime = new URL('../.sites-runtime/', import.meta.url);
mkdirSync(runtime, { recursive: true });
writeFileSync(new URL('wrangler.json', runtime), JSON.stringify(config, null, 2) + '\n');
console.log('Cloudflare 배포 설정을 준비했습니다.');

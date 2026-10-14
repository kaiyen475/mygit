import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const accountPattern = /^[a-f0-9]{32}$/i;
const databasePattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const databaseName = 'vitall-field-notes';
const apiOrigin = 'https://api.cloudflare.com/client/v4';

async function configure() {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const password = process.env.ADMIN_PASSWORD;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  let databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
  const missing = [];
  if (!token) missing.push('CLOUDFLARE_API_TOKEN');
  if (!password) missing.push('ADMIN_PASSWORD');
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (missing.length) throw new Error(`GitHub Actions Secrets에 다음 값을 등록하세요: ${missing.join(', ')}`);
  if (password.length > 200 || !password.trim()) {
    throw new Error('ADMIN_PASSWORD에는 1~200자의 운영자 비밀번호를 입력하세요.');
  }
  if (password !== password.trim()) {
    throw new Error('ADMIN_PASSWORD의 앞뒤 공백을 제거해 주세요.');
  }

  if (!accountPattern.test(accountId)) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID에는 Cloudflare의 32자리 Account ID를 입력하세요.');
  }
  if (databaseId && !databasePattern.test(databaseId)) {
    throw new Error('CLOUDFLARE_D1_DATABASE_ID에는 D1의 Database ID를 입력하세요.');
  }

  async function callApi(path, options = {}) {
    let response;
    try {
      response = await fetch(apiOrigin + path, {
        method: options.method || 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {}),
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      throw new Error('Cloudflare API에 연결하지 못했습니다. 잠시 후 워크플로를 다시 실행해 주세요.');
    }
    if (!response.ok) {
      throw new Error(`Cloudflare API 요청이 실패했습니다(HTTP ${response.status}). API 토큰의 권한과 선택한 계정을 확인해 주세요.`);
    }
    let payload;
    try { payload = await response.json(); } catch {
      throw new Error('Cloudflare API 응답을 확인하지 못했습니다. 잠시 후 다시 실행해 주세요.');
    }
    if (payload?.success !== true) {
      throw new Error('Cloudflare API 요청이 거부되었습니다. API 토큰의 권한과 선택한 계정을 확인해 주세요.');
    }
    return payload;
  }

  async function findDatabase() {
    const matches = [];
    for (let page = 1; ; page += 1) {
      if (page > 1000) throw new Error('D1 데이터베이스 목록이 너무 많습니다. CLOUDFLARE_D1_DATABASE_ID를 직접 등록하세요.');
      const payload = await callApi(`/accounts/${accountId}/d1/database?per_page=100&page=${page}`);
      if (!Array.isArray(payload.result)) throw new Error('Cloudflare D1 데이터베이스 목록을 확인하지 못했습니다.');
      matches.push(...payload.result.filter(database => database?.name === databaseName));
      if (matches.length > 1) {
        throw new Error('같은 이름의 D1 데이터베이스가 여러 개입니다. 사용할 CLOUDFLARE_D1_DATABASE_ID를 GitHub Actions Variables에 등록하세요.');
      }
      const totalPages = payload.result_info?.total_pages;
      if (Number.isInteger(totalPages) && totalPages >= 0) {
        if (page >= totalPages) break;
      } else if (payload.result.length < 100) break;
    }
    if (!matches.length) return undefined;
    const foundId = matches[0]?.uuid;
    if (typeof foundId !== 'string' || !databasePattern.test(foundId)) {
      throw new Error('기존 Cloudflare D1 Database ID를 확인하지 못했습니다. CLOUDFLARE_D1_DATABASE_ID를 직접 등록하세요.');
    }
    return foundId;
  }

  const explicitDatabase = Boolean(databaseId);
  if (!databaseId) {
    databaseId = await findDatabase();
    if (!databaseId) {
      try {
        databaseId = (await callApi(`/accounts/${accountId}/d1/database`, {
          method: 'POST', body: { name: databaseName },
        })).result?.uuid;
      } catch (creationError) {
        // A simultaneous deployment may have created the same database.
        try { databaseId = await findDatabase(); } catch { throw creationError; }
        if (!databaseId) throw creationError;
      }
    }
    if (typeof databaseId !== 'string' || !databasePattern.test(databaseId)) {
      throw new Error('Cloudflare D1 Database ID를 확인하지 못했습니다. 워크플로를 다시 실행하거나 CLOUDFLARE_D1_DATABASE_ID를 직접 등록하세요.');
    }
  }

  const config = JSON.parse(readFileSync(new URL('../wrangler.json', import.meta.url), 'utf8'));
  config.main = '../dist/server/index.js';
  config.account_id = accountId;
  const binding = config.d1_databases.find(database => database.binding === 'DB');
  if (!binding) throw new Error('Worker 설정에 DB 데이터베이스 연결이 없습니다.');
  binding.database_id = databaseId;
  if (!explicitDatabase) binding.database_name = databaseName;
  binding.migrations_dir = '../drizzle';
  const runtime = new URL('../.sites-runtime/', import.meta.url);
  mkdirSync(runtime, { recursive: true });
  writeFileSync(new URL('wrangler.json', runtime), JSON.stringify(config, null, 2) + '\n');
  console.log('Cloudflare 계정과 D1 저장소를 확인하고 배포 설정을 준비했습니다.');
}

try { await configure(); } catch (error) {
  const message = error instanceof Error ? error.message : 'Cloudflare 배포 설정을 준비하지 못했습니다.';
  const annotation = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error(`::error title=Cloudflare 배포 설정 확인::${annotation}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, [
      '## Cloudflare 배포 설정을 확인해 주세요',
      '', message, '',
      '[Repository secrets 설정 열기](https://github.com/kaiyen475/mygit/settings/secrets/actions)',
      '',
      '**Secrets → New repository secret**에서 다음 이름을 정확히 등록하세요:',
      '',
      '- `CLOUDFLARE_API_TOKEN`: Cloudflare 배포 토큰',
      '- `CLOUDFLARE_ACCOUNT_ID`: 32자 Cloudflare Account ID',
      '- `ADMIN_PASSWORD`: 운영자 비밀번호',
      '',
      '[처음 설정 방법](https://github.com/kaiyen475/mygit/blob/main/DEPLOY.md)',
      '',
    ].join('\n'));
  }
  process.exitCode = 1;
}

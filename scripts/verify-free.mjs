import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

// Exercise the production API and additive migrations without npm or a network.
const projectRoot = new URL('../', import.meta.url);
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'vitall-api-check-'));
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
const migrationFiles = readdirSync(new URL('drizzle/', projectRoot)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
assert.equal(migrationFiles[0], '0000_vitall.sql');
sqlite.exec(readFileSync(new URL(`drizzle/${migrationFiles[0]}`, projectRoot), 'utf8'));
// Start with the old production schema and a real application before upgrading.
sqlite.prepare('INSERT INTO expeditions VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(
  'migration-event', '이전 게시물', '조류', '2099-01-02T00:00:00.000Z', '2099-01-01T00:00:00.000Z',
  '기존 장소', '기존 안내', '["정문"]', 5, 'open', 0, '2026-01-01T00:00:00.000Z',
);
sqlite.prepare('INSERT INTO applicants VALUES (?,?,?,?,?,?,?,?,?,?)').run(
  'migration-person', 'migration-event', '이전 신청자', '01012345678', 1, 0, '정문', 1,
  'migration-request', '2026-01-01T00:00:00.000Z',
);
for (const name of migrationFiles.slice(1)) sqlite.exec(readFileSync(new URL(`drizzle/${name}`, projectRoot), 'utf8'));
const migrated = sqlite.prepare('SELECT * FROM applicants WHERE id=?').get('migration-person');
assert.equal(migrated.name, '이전 신청자');
assert.equal(migrated.phone, '01012345678');
assert.equal(migrated.message, '');
assert.equal(sqlite.prepare('SELECT title FROM expeditions WHERE id=?').get('migration-event').title, '이전 게시물');
assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expedition_photos').get().count, 0);
sqlite.exec('DELETE FROM applicants; DELETE FROM expeditions;');

let beforeMutation;
let blobShape = 'array';
const rowWithD1Blobs = (row) => {
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Uint8Array
    ? blobShape === 'array' ? Array.from(value) : blobShape === 'arrayBuffer' ? Uint8Array.from(value).buffer : value
    : value]));
};

const d1 = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    return {
      bind(...parameters) { values = parameters.map((value) => value instanceof ArrayBuffer ? new Uint8Array(value) : value); return this; },
      async first() { return rowWithD1Blobs(statement.get(...values)); },
      async all() { return { results: statement.all(...values).map(rowWithD1Blobs) }; },
      async run() {
        if (beforeMutation?.matches(sql)) {
          const hook = beforeMutation;
          beforeMutation = undefined;
          hook.run();
        }
        const result = statement.run(...values);
        return { meta: { changes: result.changes } };
      },
    };
  },
  async batch(statements) {
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    }
  },
};

const password = 'local-test-only';
globalThis.__VITALL_TEST_BINDINGS__ = { DB: d1, ADMIN_PASSWORD: password };
let groups = 0;
const passed = (label) => { groups += 1; console.log(`PASS ${label}`); };
passed('additive migrations preserve existing posts and applications with an empty optional message');

try {
  const source = readFileSync(new URL('app/api/service.ts', projectRoot), 'utf8');
  const stubbed = source.replace(
    "import { env } from 'cloudflare:workers';",
    'const env = globalThis.__VITALL_TEST_BINDINGS__;',
  );
  assert.notEqual(stubbed, source, 'Cloudflare env import must be replaced for this check');
  const modulePath = join(temporaryDirectory, 'service.mjs');
  writeFileSync(modulePath, stripTypeScriptTypes(stubbed, { mode: 'transform' }));
  const { api } = await import(pathToFileURL(modulePath).href);
  const origin = 'https://vitall.test';
  const request = (path, method = 'GET', payload, cookie, requestOrigin = origin) => new Request(origin + path, {
    method,
    headers: {
      ...(payload === undefined ? {} : { 'content-type': 'application/json', origin: requestOrigin }),
      ...(cookie ? { cookie } : {}),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
  const rawPhotoRequest = (eventId, bytes, {
    uploadId = crypto.randomUUID(), type = 'image/png', session, requestOrigin = origin, headers = {},
  } = {}) => new Request(`${origin}/api/expeditions/${eventId}/photos`, {
    method: 'POST',
    headers: { 'content-type': type, 'x-upload-id': uploadId, origin: requestOrigin, ...(session ? { cookie: session } : {}), ...headers },
    body: bytes,
  });
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nWQAAAAASUVORK5CYII=', 'base64'));
  const event = {
    title: '검증용 탐사', category: '조류',
    date: new Date(Date.now() + 7 * 86400000).toISOString(),
    deadline: new Date(Date.now() + 6 * 86400000).toISOString(),
    location: '검증 장소', description: '검증 안내',
    meetingPlaces: ['정문', '현장'], capacity: 1, status: 'open', isExample: false,
  };

  let response = await api(request('/api/expeditions', 'POST', event), 'save');
  assert.equal(response.status, 401);
  passed('anonymous posting requires an administrator session');

  response = await api(request('/api/admin/login', 'POST', { password: 'incorrect' }), 'login');
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('set-cookie'), null);
  response = await api(request('/api/admin/login', 'POST', { password }), 'login');
  assert.equal(response.status, 200);
  const setCookie = response.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Secure/);
  const cookie = setCookie.split(';')[0];
  passed('password authentication and secure session cookie');

  response = await api(request('/api/expeditions', 'POST', event, cookie), 'save');
  assert.equal(response.status, 201);
  const eventId = (await response.json()).event.id;
  response = await api(request(`/api/expeditions/${eventId}`, 'PUT', event), 'save', eventId);
  assert.equal(response.status, 401);
  passed('administrator creates an expedition and anonymous editing is denied');

  const firstApplication = {
    name: '검증 참가자 가', phone: '010-1111-2222', binoculars: true, boots: false,
    meetingPlace: '정문', meal: true, consent: true, message: '  검증용 비공개 메모\n장비 문의  ', idempotencyKey: 'verification-request-a',
  };
  const secondApplication = {
    ...firstApplication, name: '검증 참가자 나', phone: '010-3333-4444', idempotencyKey: 'verification-request-b',
  };
  const applicationPath = `/api/expeditions/${eventId}/apply`;
  const applications = [firstApplication, secondApplication];
  const competing = await Promise.all(applications.map((application) => api(request(applicationPath, 'POST', application), 'apply', eventId)));
  assert.deepEqual(competing.map((result) => result.status).sort(), [201, 409]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM applicants WHERE event_id=?').get(eventId).count, 1);
  const winner = applications[competing.findIndex((result) => result.status === 201)];
  passed('two concurrent applicants cannot exceed a capacity of one');

  response = await api(request(applicationPath, 'POST', winner), 'apply', eventId);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).count, 1);
  for (const change of [{ binoculars: false }, { boots: true }, { meal: false }, { meetingPlace: '현장' }, { message: '다른 메모' }]) {
    response = await api(request(applicationPath, 'POST', { ...winner, ...change }), 'apply', eventId);
    assert.equal(response.status, 409);
  }
  response = await api(request(applicationPath, 'POST', { ...winner, idempotencyKey: 'different-request-key' }), 'apply', eventId);
  assert.equal(response.status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM applicants WHERE event_id=?').get(eventId).count, 1);
  passed('idempotent retry succeeds while changed choices and duplicate people are rejected');

  response = await api(request(`/api/expeditions/${eventId}`), 'detail', eventId);
  assert.equal(response.status, 200);
  const publicDetail = await response.json();
  assert.equal(publicDetail.admin, false);
  assert.equal(publicDetail.event.count, 1);
  assert.deepEqual(publicDetail.signedUp, [{ name: winner.name }]);
  assert.equal(publicDetail.applicants, undefined);
  const publicBody = JSON.stringify(publicDetail);
  for (const privateKey of ['phone', 'binoculars', 'boots', 'meal', 'meetingPlace', 'message', 'createdAt']) {
    assert(!publicBody.includes(`"${privateKey}":`), `Public body leaked ${privateKey}`);
  }
  assert(!publicBody.includes(winner.phone.replaceAll('-', '')));
  assert(!publicBody.includes(winner.message.trim()));
  passed('public applicant details contain names and count without private fields');

  response = await api(request(`/api/expeditions/${eventId}`, 'GET', undefined, cookie), 'detail', eventId);
  const adminDetail = await response.json();
  assert.equal(adminDetail.admin, true);
  assert.equal(adminDetail.applicants.length, 1);
  const applicant = adminDetail.applicants[0];
  assert.equal(applicant.name, winner.name);
  assert.equal(applicant.phone, winner.phone.replaceAll('-', ''));
  assert.equal(applicant.binoculars, winner.binoculars);
  assert.equal(applicant.boots, winner.boots);
  assert.equal(applicant.meetingPlace, winner.meetingPlace);
  assert.equal(applicant.meal, winner.meal);
  assert.equal(applicant.message, winner.message.trim());
  assert(applicant.id && applicant.createdAt);
  passed('authenticated administrator receives complete application information');

  response = await api(request('/api/expeditions', 'POST', { ...event, capacity: 0 }, cookie), 'save');
  const notesEventId = (await response.json()).event.id;
  const notesPath = `/api/expeditions/${notesEventId}/apply`;
  const noteApplication = { ...firstApplication, name: '메모 검증', phone: '010-5555-6666', idempotencyKey: 'notes-request' };
  for (const message of ['가'.repeat(1001), '🌱'.repeat(501), null, 10, {}]) {
    response = await api(request(notesPath, 'POST', { ...noteApplication, message }), 'apply', notesEventId);
    assert.equal(response.status, 400, 'invalid notes must be rejected before storage');
  }
  response = await api(request(notesPath, 'POST', { ...noteApplication, message: '🌱'.repeat(500) }), 'apply', notesEventId);
  assert.equal(response.status, 201);
  assert.equal(sqlite.prepare('SELECT length(message) AS length FROM applicants WHERE event_id=?').get(notesEventId).length, 500);
  const withoutMessage = { ...noteApplication, name: '메모 생략', phone: '010-7777-8888', idempotencyKey: 'omitted-notes-request' };
  delete withoutMessage.message;
  response = await api(request(notesPath, 'POST', withoutMessage), 'apply', notesEventId);
  assert.equal(response.status, 201);
  assert.equal(sqlite.prepare('SELECT message FROM applicants WHERE idempotency_key=?').get(withoutMessage.idempotencyKey).message, '');
  response = await api(request(notesPath, 'POST', { ...withoutMessage, message: '  \n  ' }), 'apply', notesEventId);
  assert.equal(response.status, 200);
  passed('optional notes default to empty, trim whitespace, and enforce 1000 UTF-16 units');

  response = await api(rawPhotoRequest(eventId, png), 'uploadPhoto', eventId);
  assert.equal(response.status, 401);
  response = await api(rawPhotoRequest(eventId, png, { session: cookie, requestOrigin: 'https://foreign.test' }), 'uploadPhoto', eventId);
  assert.equal(response.status, 403);
  response = await api(rawPhotoRequest('example-birds', png, { session: cookie }), 'uploadPhoto', 'example-birds');
  assert.equal(response.status, 400);
  response = await api(rawPhotoRequest('missing-event', png, { session: cookie }), 'uploadPhoto', 'missing-event');
  assert.equal(response.status, 404);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expedition_photos').get().count, 0);
  passed('only administrators on the same origin can upload to saved expeditions');

  for (const [bytes, options, status] of [
    [png, { type: 'image/svg+xml' }, 415],
    [new TextEncoder().encode('<svg>not a PNG</svg>'), {}, 415],
    [png, { type: 'image/jpeg' }, 415],
    [new Uint8Array(), {}, 400],
    [png, { uploadId: 'not-a-uuid' }, 400],
    [png, { headers: { 'content-length': String(1024 * 1024 + 1) } }, 413],
    [new Uint8Array(1024 * 1024 + 1), {}, 413],
  ]) {
    response = await api(rawPhotoRequest(eventId, bytes, { ...options, session: cookie }), 'uploadPhoto', eventId);
    assert.equal(response.status, status);
  }
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expedition_photos').get().count, 0);
  passed('photo uploads reject unsupported or mismatched formats, invalid IDs, empty files, and oversized streams');

  const firstPhotoId = crypto.randomUUID();
  response = await api(rawPhotoRequest(eventId, png, { session: cookie, uploadId: firstPhotoId }), 'uploadPhoto', eventId);
  assert.equal(response.status, 201);
  const firstPhoto = (await response.json()).photo;
  assert.deepEqual(firstPhoto, { id: firstPhotoId, url: `/api/photos/${firstPhotoId}` });
  response = await api(rawPhotoRequest(eventId, png, { session: cookie, uploadId: firstPhotoId }), 'uploadPhoto', eventId);
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).photo, firstPhoto);
  const alteredPng = Uint8Array.from(png);
  alteredPng[alteredPng.length - 1] ^= 1;
  response = await api(rawPhotoRequest(eventId, alteredPng, { session: cookie, uploadId: firstPhotoId }), 'uploadPhoto', eventId);
  assert.equal(response.status, 409);
  response = await api(rawPhotoRequest(notesEventId, png, { session: cookie, uploadId: firstPhotoId }), 'uploadPhoto', notesEventId);
  assert.equal(response.status, 409);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expedition_photos WHERE event_id=?').get(eventId).count, 1);
  passed('photo upload retries are idempotent while changed bytes or a changed parent conflict');

  for (const shape of ['array', 'arrayBuffer', 'typedArray']) {
    blobShape = shape;
    response = await api(request(firstPhoto.url), 'photo', firstPhotoId);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('content-length'), String(png.byteLength));
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), png);
  }
  blobShape = 'array';
  for (const action of ['list', 'detail']) {
    response = await api(request(action === 'list' ? '/api/expeditions' : `/api/expeditions/${eventId}`), action, action === 'detail' ? eventId : undefined);
    const result = await response.json();
    const exposed = action === 'list' ? result.events.find((entry) => entry.id === eventId) : result.event;
    assert.deepEqual(exposed.photos, [firstPhoto]);
    const serialized = JSON.stringify(result);
    for (const key of ['data', 'sha256', 'content_type', 'message']) assert(!serialized.includes(`"${key}":`));
    assert(!serialized.includes(Buffer.from(png).toString('base64')));
  }
  passed('public photo endpoints return exact bytes and event JSON contains metadata without binary or private notes');

  const maxPhoto = new Uint8Array(1024 * 1024);
  maxPhoto.set(png);
  response = await api(rawPhotoRequest(notesEventId, maxPhoto, { session: cookie }), 'uploadPhoto', notesEventId);
  assert.equal(response.status, 201);
  for (const [type, bytes] of [
    ['image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 2, 0xff, 0xd9])],
    ['image/webp', Uint8Array.from(Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64'))],
  ]) {
    response = await api(rawPhotoRequest(notesEventId, bytes, { session: cookie, type }), 'uploadPhoto', notesEventId);
    assert.equal(response.status, 201);
    const uploaded = (await response.json()).photo;
    response = await api(request(uploaded.url), 'photo', uploaded.id);
    assert.equal(response.headers.get('content-type'), type);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  }
  passed('the one MiB boundary and JPEG, PNG, and WebP types are accepted');

  const concurrentPhotos = await Promise.all(Array.from({ length: 5 }, () => api(rawPhotoRequest(eventId, png, { session: cookie }), 'uploadPhoto', eventId)));
  assert.deepEqual(concurrentPhotos.map((result) => result.status).sort(), [201, 201, 201, 201, 409]);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expedition_photos WHERE event_id=?').get(eventId).count, 5);
  response = await api(rawPhotoRequest(eventId, png, { session: cookie, uploadId: firstPhotoId }), 'uploadPhoto', eventId);
  assert.equal(response.status, 200, 'retry remains successful even after the photo quota fills');
  response = await api(request(`/api/expeditions/${eventId}`, 'PUT', event, cookie), 'save', eventId);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).event.photos.length, 5);
  passed('concurrent photo uploads enforce five photos and editing a post preserves its photos');

  const photoDeletePath = `/api/expeditions/${eventId}/photos/${firstPhotoId}`;
  response = await api(request(photoDeletePath, 'DELETE', {}), 'deletePhoto', eventId, firstPhotoId);
  assert.equal(response.status, 401);
  response = await api(request(photoDeletePath, 'DELETE', {}, cookie, 'https://foreign.test'), 'deletePhoto', eventId, firstPhotoId);
  assert.equal(response.status, 403);
  response = await api(request(`/api/expeditions/${notesEventId}/photos/${firstPhotoId}`, 'DELETE', {}, cookie), 'deletePhoto', notesEventId, firstPhotoId);
  assert.equal(response.status, 200);
  response = await api(request(firstPhoto.url), 'photo', firstPhotoId);
  assert.equal(response.status, 200, 'a different parent cannot remove this photo');
  response = await api(request(photoDeletePath, 'DELETE', {}, cookie), 'deletePhoto', eventId, firstPhotoId);
  assert.equal(response.status, 200);
  response = await api(request(photoDeletePath, 'DELETE', {}, cookie), 'deletePhoto', eventId, firstPhotoId);
  assert.equal(response.status, 200);
  response = await api(request(firstPhoto.url), 'photo', firstPhotoId);
  assert.equal(response.status, 404);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expedition_photos WHERE event_id=?').get(eventId).count, 4);
  passed('photo deletion checks administrator, origin, and parent while repeated removal is safe');

  response = await api(request('/api/admin/login', 'POST', { password }, undefined, 'https://foreign.test'), 'login');
  assert.equal(response.status, 403);
  response = await api(request(applicationPath, 'POST', winner, undefined, 'https://foreign.test'), 'apply', eventId);
  assert.equal(response.status, 403);
  response = await api(request('/api/expeditions', 'POST', event, cookie, 'https://foreign.test'), 'save');
  assert.equal(response.status, 403);
  passed('foreign origins cannot log in, apply, or post');

  response = await api(request('/api/expeditions/example-birds/apply', 'POST', {
    ...winner, meetingPlace: '충북대학교 정문', idempotencyKey: 'example-verification-request',
  }), 'apply', 'example-birds');
  assert.equal(response.status, 400);
  passed('example announcements do not accept real applications');

  for (const closedEvent of [
    { ...event, status: 'closed' },
    { ...event, date: new Date(Date.now() - 86400000).toISOString(), deadline: new Date(Date.now() - 2 * 86400000).toISOString() },
  ]) {
    response = await api(request('/api/expeditions', 'POST', closedEvent, cookie), 'save');
    assert.equal(response.status, 201);
    const closedId = (await response.json()).event.id;
    response = await api(request(`/api/expeditions/${closedId}/apply`, 'POST', {
      ...winner, idempotencyKey: `closed-verification-${closedId}`,
    }), 'apply', closedId);
    assert.equal(response.status, 409);
  }
  passed('closed and expired expeditions reject new applications');

  const deletePath = `/api/expeditions/${eventId}`;
  response = await api(request(deletePath, 'DELETE', {}), 'delete', eventId);
  assert.equal(response.status, 401);
  response = await api(request(deletePath, 'DELETE', {}, cookie, 'https://foreign.test'), 'delete', eventId);
  assert.equal(response.status, 403);
  response = await api(new Request(origin + deletePath, { method: 'DELETE', headers: { cookie, origin } }), 'delete', eventId);
  assert.equal(response.status, 415);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM applicants WHERE event_id=?').get(eventId).count, 1);
  response = await api(request(deletePath, 'DELETE', {}, cookie), 'delete', eventId);
  assert.equal(response.status, 200);
  for (const table of ['expeditions', 'applicants', 'expedition_photos']) {
    const column = table === 'expeditions' ? 'id' : 'event_id';
    assert.equal(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${column}=?`).get(eventId).count, 0);
  }
  response = await api(request(deletePath), 'detail', eventId);
  assert.equal(response.status, 404);
  response = await api(request(deletePath, 'DELETE', {}, cookie), 'delete', eventId);
  assert.equal(response.status, 404);
  response = await api(request(deletePath, 'PUT', event, cookie), 'save', eventId);
  assert.equal(response.status, 404);
  passed('post deletion requires authenticated JSON and removes the post, applicants, and all photos atomically');

  response = await api(request('/api/expeditions', 'POST', event, cookie), 'save');
  const raceId = (await response.json()).event.id;
  beforeMutation = {
    matches: (sql) => sql.startsWith('UPDATE expeditions SET'),
    run: () => sqlite.prepare('DELETE FROM expeditions WHERE id=?').run(raceId),
  };
  response = await api(request(`/api/expeditions/${raceId}`, 'PUT', event, cookie), 'save', raceId);
  assert.equal(response.status, 409);
  assert.equal(beforeMutation, undefined, 'the deletion must happen between the read and update');
  assert.equal(sqlite.prepare('SELECT id FROM expeditions WHERE id=?').get(raceId), undefined);
  passed('an edit that races with post deletion cannot recreate the deleted post');

  const realCountBeforeVirtualRace = sqlite.prepare('SELECT COUNT(*) AS count FROM expeditions').get().count;
  beforeMutation = {
    matches: (sql) => sql.startsWith('INSERT INTO expeditions '),
    run: () => sqlite.prepare('INSERT INTO deleted_examples (id,created_at) VALUES (?,?)').run('example-birds', new Date().toISOString()),
  };
  response = await api(request('/api/expeditions/example-birds', 'PUT', event, cookie), 'save', 'example-birds');
  assert.equal(response.status, 409);
  assert.equal(beforeMutation, undefined);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expeditions').get().count, realCountBeforeVirtualRace);
  for (const exampleId of ['example-plants', 'example-wetland']) {
    response = await api(request(`/api/expeditions/${exampleId}`, 'DELETE', {}, cookie), 'delete', exampleId);
    assert.equal(response.status, 200);
  }
  for (const { id } of sqlite.prepare('SELECT id FROM expeditions').all()) {
    response = await api(request(`/api/expeditions/${id}`, 'DELETE', {}, cookie), 'delete', id);
    assert.equal(response.status, 200);
  }
  for (const exampleId of ['example-birds', 'example-plants', 'example-wetland']) {
    response = await api(request(`/api/expeditions/${exampleId}`), 'detail', exampleId);
    assert.equal(response.status, 404);
    response = await api(request(`/api/expeditions/${exampleId}`, 'PUT', event, cookie), 'save', exampleId);
    assert.equal(response.status, 404);
  }
  response = await api(request('/api/expeditions'), 'list');
  assert.deepEqual((await response.json()).events, []);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM deleted_examples').get().count, 3);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM expedition_photos').get().count, 0);
  passed('deleted examples stay hidden after the final real post is deleted and stale conversion cannot restore them');

  response = await api(request('/api/expeditions', 'POST', event, cookie), 'save');
  assert.equal(response.status, 201, 'an administrator can post again after emptying the board');
  const logoutEventId = (await response.json()).event.id;

  response = await api(request('/api/admin/logout', 'POST', {}, cookie), 'logout');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  response = await api(request(`/api/expeditions/${logoutEventId}`, 'GET', undefined, cookie), 'detail', logoutEventId);
  const loggedOut = await response.json();
  assert.equal(loggedOut.admin, false);
  assert.equal(loggedOut.applicants, undefined);
  response = await api(request('/api/expeditions', 'POST', event, cookie), 'save');
  assert.equal(response.status, 401);
  assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM admin_sessions').get().count, 0);
  passed('logout invalidates the server session and private access');

  console.log(`${groups} API verification groups passed using the production migration and service.`);
} finally {
  delete globalThis.__VITALL_TEST_BINDINGS__;
  sqlite.close();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';

// Exercise the production API and migration without npm packages or a network.
const projectRoot = new URL('../', import.meta.url);
const temporaryDirectory = mkdtempSync(join(tmpdir(), 'vitall-api-check-'));
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
sqlite.exec(readFileSync(new URL('drizzle/0000_vitall.sql', projectRoot), 'utf8'));

const d1 = {
  prepare(sql) {
    const statement = sqlite.prepare(sql);
    let values = [];
    return {
      bind(...parameters) { values = parameters; return this; },
      async first() { return statement.get(...values) ?? null; },
      async all() { return { results: statement.all(...values) }; },
      async run() {
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
    meetingPlace: '정문', meal: true, consent: true, idempotencyKey: 'verification-request-a',
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
  for (const change of [{ binoculars: false }, { boots: true }, { meal: false }, { meetingPlace: '현장' }]) {
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
  for (const privateKey of ['phone', 'binoculars', 'boots', 'meal', 'meetingPlace', 'createdAt']) {
    assert(!publicBody.includes(`"${privateKey}":`), `Public body leaked ${privateKey}`);
  }
  assert(!publicBody.includes(winner.phone.replaceAll('-', '')));
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
  assert(applicant.id && applicant.createdAt);
  passed('authenticated administrator receives complete application information');

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

  response = await api(request('/api/admin/logout', 'POST', {}, cookie), 'logout');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  response = await api(request(`/api/expeditions/${eventId}`, 'GET', undefined, cookie), 'detail', eventId);
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

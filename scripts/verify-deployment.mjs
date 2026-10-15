/** Verify the deployed API without creating expeditions or applications. */
import { setTimeout as delay } from 'node:timers/promises';

class VerificationError extends Error {}
class RequestError extends VerificationError {}

function check(condition, message) {
  if (!condition) throw new VerificationError(message);
}

function passed(message) {
  console.log(`PASS: ${message}`);
}

function validPhotos(event) {
  return event && Array.isArray(event.photos) && event.photos.length <= 5 &&
    event.photos.every(photo => photo && Object.keys(photo).sort().join(',') === 'id,url' &&
      typeof photo.id === 'string' && /^[a-f0-9-]{36}$/.test(photo.id) &&
      photo.url === `/api/photos/${photo.id}`);
}

function deploymentOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new VerificationError('DEPLOYMENT_URL must be the deployed Workers HTTPS URL.');
  }
  check(
    url.protocol === 'https:' &&
      /^vitall-field-notes\.[a-z0-9-]+\.workers\.dev$/.test(url.hostname) &&
      !url.username && !url.password && !url.port &&
      url.pathname === '/' && !url.search && !url.hash,
    'DEPLOYMENT_URL must be the deployed Workers HTTPS URL.',
  );
  return url.origin;
}

async function request(origin, path, { body, cookie, method } = {}) {
  const headers = { Accept: 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (body !== undefined) {
    headers.Origin = origin;
    headers['Content-Type'] = 'application/json';
  }
  try {
    return await fetch(new URL(path, origin), {
      method: method || (body === undefined ? 'GET' : 'POST'),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new RequestError('An API request failed or timed out.');
  }
}

async function json(response, description) {
  try {
    const value = await response.json();
    check(value && typeof value === 'object' && !Array.isArray(value), `${description}: invalid JSON response.`);
    return value;
  } catch (error) {
    if (error instanceof VerificationError) throw error;
    throw new VerificationError(`${description}: invalid JSON response.`);
  }
}

async function initialList(origin) {
  for (let attempt = 0; attempt < 5; attempt++) {
    let response;
    try {
      response = await request(origin, '/api/expeditions');
    } catch (error) {
      if (!(error instanceof RequestError) || attempt === 4) throw error;
      await delay(3_000);
      continue;
    }
    if (response.status >= 500 && attempt < 4) {
      await response.body?.cancel();
      await delay(3_000);
      continue;
    }
    check(response.status === 200, 'Public expedition listing is unavailable.');
    const result = await json(response, 'Public expedition listing');
    check(result.admin === false && Array.isArray(result.events), 'Public expedition listing has an unexpected shape.');
    check(result.events.every(validPhotos), 'Public photo metadata is unavailable or invalid.');
    passed('Database and public expedition listing are available.');
    return result;
  }
  throw new VerificationError('Public expedition listing is unavailable.');
}

async function main() {
  check(process.env.DEPLOYMENT_URL, 'Missing required environment variable: DEPLOYMENT_URL.');
  check(process.env.ADMIN_PASSWORD, 'Missing required environment variable: ADMIN_PASSWORD.');
  const origin = deploymentOrigin(process.env.DEPLOYMENT_URL);
  const publicList = await initialList(origin);

  const blockedSave = await request(origin, '/api/expeditions', { body: {} });
  check(blockedSave.status === 401, 'Anonymous expedition creation was not rejected.');
  await blockedSave.body?.cancel();
  passed('Anonymous expedition creation is blocked.');

  let cookie;
  let loggedIn = false;
  try {
    const login = await request(origin, '/api/admin/login', { body: { password: process.env.ADMIN_PASSWORD } });
    check(login.status === 200, 'Administrator login failed.');
    loggedIn = true;
    check(typeof login.headers.getSetCookie === 'function', 'The runner must support secure session cookie inspection.');
    const session = login.headers.getSetCookie().find(value => /^vitall_admin=/.test(value));
    if (session) {
      const candidate = session.split(';', 1)[0];
      if (/^vitall_admin=[a-f0-9]{64}$/.test(candidate)) cookie = candidate;
    }
    check(cookie && /;\s*Secure(?:;|$)/i.test(session) && /;\s*HttpOnly(?:;|$)/i.test(session) && /;\s*SameSite=Strict(?:;|$)/i.test(session), 'Administrator session cookie is missing required security attributes.');
    check((await json(login, 'Administrator login')).success === true, 'Administrator login did not succeed.');
    passed('Administrator login and secure session cookie are working.');

    const adminListResponse = await request(origin, '/api/expeditions', { cookie });
    check(adminListResponse.status === 200, 'Authenticated expedition listing failed.');
    const adminList = await json(adminListResponse, 'Authenticated expedition listing');
    check(adminList.admin === true && Array.isArray(adminList.events), 'Authenticated expedition listing did not grant administrator access.');
    passed('Authenticated administrator access is working.');

    if (publicList.events.length) {
      const id = publicList.events[0]?.id;
      check(typeof id === 'string' && /^[a-zA-Z0-9-]{1,128}$/.test(id), 'An expedition has an invalid identifier.');
      const path = `/api/expeditions/${encodeURIComponent(id)}`;
      const blockedDelete = await request(origin, path, { method: 'DELETE', body: {} });
      check(blockedDelete.status === 401, 'Anonymous expedition deletion was not rejected.');
      await blockedDelete.body?.cancel();
      passed('Anonymous expedition deletion is blocked.');
      const publicDetailResponse = await request(origin, path);
      check(publicDetailResponse.status === 200, 'Public expedition detail failed.');
      const publicDetail = await json(publicDetailResponse, 'Public expedition detail');
      check(validPhotos(publicDetail.event), 'Public expedition photo metadata is invalid.');
      check(
        publicDetail.admin === false && Array.isArray(publicDetail.signedUp) &&
          !Object.hasOwn(publicDetail, 'applicants') &&
          publicDetail.signedUp.every(value => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && typeof value.name === 'string'),
        'Public applicant details must expose names only.',
      );
      passed('Public applicant information is limited to names.');

      const unavailablePhoto = '00000000-0000-4000-8000-000000000000';
      const blockedPhotoDelete = await request(origin, `${path}/photos/${unavailablePhoto}`, { method: 'DELETE', body: {} });
      check(blockedPhotoDelete.status === 401, 'Anonymous photo deletion was not rejected.');
      await blockedPhotoDelete.body?.cancel();
      let blockedPhotoUpload;
      try {
        blockedPhotoUpload = await fetch(new URL(`${path}/photos`, origin), {
          method: 'POST', headers: { Origin: origin, 'Content-Type': 'image/jpeg', 'X-Upload-Id': unavailablePhoto },
          body: new Uint8Array([255, 216, 255]), redirect: 'error', signal: AbortSignal.timeout(20_000),
        });
      } catch { throw new RequestError('Photo authorization verification failed or timed out.'); }
      check(blockedPhotoUpload.status === 401, 'Anonymous photo upload was not rejected.');
      await blockedPhotoUpload.body?.cancel();
      passed('Anonymous photo upload and deletion are blocked.');

      if (publicDetail.event.photos.length) {
        const photo = await request(origin, publicDetail.event.photos[0].url);
        check(photo.status === 200 && ['image/jpeg', 'image/png', 'image/webp'].includes(photo.headers.get('content-type')), 'A published photo is unavailable.');
        const size = (await photo.arrayBuffer()).byteLength;
        check(size > 0 && size <= 1024 * 1024 && photo.headers.get('x-content-type-options') === 'nosniff', 'A published photo has invalid content headers or size.');
        passed('Published photo delivery is working.');
      }

      const adminDetailResponse = await request(origin, path, { cookie });
      check(adminDetailResponse.status === 200, 'Authenticated expedition detail failed.');
      const adminDetail = await json(adminDetailResponse, 'Authenticated expedition detail');
      check(adminDetail.admin === true && Array.isArray(adminDetail.applicants) && adminDetail.applicants.every(applicant => typeof applicant.message === 'string'), 'Administrator applicant messages are unavailable.');
      passed('Administrator applicant detail access is working.');
    }
  } finally {
    if (loggedIn) {
      const logout = await request(origin, '/api/admin/logout', { body: {}, cookie });
      check(logout.status === 200 && (await json(logout, 'Administrator logout')).success === true, 'Administrator session cleanup failed.');
      passed('Verification administrator session was logged out.');
    }
  }

  const revokedResponse = await request(origin, '/api/expeditions', { cookie });
  check(revokedResponse.status === 200, 'Session revocation verification failed.');
  check((await json(revokedResponse, 'Session revocation')).admin === false, 'The logged-out administrator session remains authorized.');
  passed('Logged-out session is no longer authorized.');
  passed('Deployment verification completed without creating expeditions or applications.');
}

try {
  await main();
} catch (error) {
  console.error(`FAIL: ${error instanceof VerificationError ? error.message : 'Deployment verification could not complete.'}`);
  process.exitCode = 1;
}

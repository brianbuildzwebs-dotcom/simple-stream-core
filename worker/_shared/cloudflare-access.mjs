import { createRemoteJWKSet, jwtVerify } from 'jose';

let cachedJwks = null;
let cachedJwksUrl = '';

function getJwks(teamDomain) {
  const normalized = teamDomain.replace(/\/$/, '');
  const certsUrl = `${normalized}/cdn-cgi/access/certs`;

  if (!cachedJwks || cachedJwksUrl !== certsUrl) {
    cachedJwksUrl = certsUrl;
    cachedJwks = createRemoteJWKSet(new URL(certsUrl));
  }

  return cachedJwks;
}

export function isCloudflareAccessConfigured(env) {
  return Boolean(env.CF_ACCESS_AUD?.trim() && env.CF_ACCESS_TEAM_DOMAIN?.trim());
}

export async function verifyCloudflareAccessRequest(request, env) {
  if (!isCloudflareAccessConfigured(env)) {
    return { ok: true, payload: null, skipped: true };
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) {
    return { ok: false, reason: 'missing_access_jwt' };
  }

  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN.trim().replace(/\/$/, '');
  const audience = env.CF_ACCESS_AUD.trim();

  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience,
    });
    return { ok: true, payload, skipped: false };
  } catch {
    return { ok: false, reason: 'invalid_access_jwt' };
  }
}
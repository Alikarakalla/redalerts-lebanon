import crypto from 'node:crypto';
import { config } from './config.js';

const ADMIN_COOKIE_NAME = 'redalerts_admin_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function getSessionSignature(payload) {
  return crypto
    .createHmac('sha256', config.adminSessionSecret)
    .update(payload)
    .digest('hex');
}

function parseCookies(header) {
  return String(header || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createAdminSessionToken() {
  const issuedAt = Date.now().toString();
  const signature = getSessionSignature(issuedAt);
  return `${issuedAt}.${signature}`;
}

export function verifyAdminCredentials(username, password) {
  return safeEqual(username, config.adminUsername) && safeEqual(password, config.adminPassword);
}

export function isAdminRequestAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[ADMIN_COOKIE_NAME];
  if (!token) {
    return false;
  }

  const [issuedAt, signature] = token.split('.');
  if (!issuedAt || !signature || !/^\d+$/.test(issuedAt)) {
    return false;
  }

  const expectedSignature = getSessionSignature(issuedAt);
  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs)) {
    return false;
  }

  return Date.now() - issuedAtMs <= SESSION_MAX_AGE_SECONDS * 1000;
}

export function buildAdminSessionCookie(token) {
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}`;
}

export function buildClearAdminSessionCookie() {
  return `${ADMIN_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

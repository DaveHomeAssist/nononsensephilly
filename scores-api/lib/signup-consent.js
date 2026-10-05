import { randomBytes, createHash } from 'node:crypto';
export const SIGNUPS = 'nn:signups';
export const CONFIRM_TTL = 86400;
export const digest = value => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const tokenKey = token => `nn:signup:confirm:${digest(token)}`;
export const validToken = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
export const consentStatus = record => record.confirmedAt ? 'confirmed' : 'legacy_unverified';

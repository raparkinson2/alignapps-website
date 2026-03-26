/**
 * Generates the Apple OAuth JWT secret needed for Supabase.
 *
 * Usage:
 *   TEAM_ID=XXXXXXXXXX KEY_ID=XXXXXXXXXX CLIENT_ID=com.your.id P8_PATH=/path/to/key.p8 bun generate-apple-jwt.mjs
 *
 * Or edit the values below directly and run:
 *   bun generate-apple-jwt.mjs
 */

import { readFileSync } from 'fs';
import { createSign } from 'crypto';

// ── Fill these in ──────────────────────────────────────────────────────────────
const TEAM_ID   = process.env.TEAM_ID   || 'YOUR_TEAM_ID';        // 10-char Apple Team ID
const KEY_ID    = process.env.KEY_ID    || 'YOUR_KEY_ID';          // 10-char Key ID from Apple
const CLIENT_ID = process.env.CLIENT_ID || 'com.vibecode.alignsports-jy5wjr'; // Bundle or Services ID
const P8_PATH   = process.env.P8_PATH   || './AuthKey.p8';         // Path to your .p8 file
// ──────────────────────────────────────────────────────────────────────────────

let privateKey;
try {
  privateKey = readFileSync(P8_PATH, 'utf8');
} catch {
  console.error(`\n❌ Could not read .p8 file at: ${P8_PATH}`);
  console.error('   Set P8_PATH env var or copy your .p8 file to this directory as AuthKey.p8\n');
  process.exit(1);
}

if (TEAM_ID === 'YOUR_TEAM_ID' || KEY_ID === 'YOUR_KEY_ID') {
  console.error('\n❌ Please set TEAM_ID and KEY_ID before running.\n');
  process.exit(1);
}

const now = Math.floor(Date.now() / 1000);
const exp = now + 15777000; // 6 months

const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: KEY_ID })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss: TEAM_ID,
  iat: now,
  exp,
  aud: 'https://appleid.apple.com',
  sub: CLIENT_ID,
})).toString('base64url');

const signingInput = `${header}.${payload}`;
const sign = createSign('SHA256');
sign.update(signingInput);
const signature = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url');

const jwt = `${signingInput}.${signature}`;

console.log('\n✅ Your Apple OAuth JWT secret:\n');
console.log(jwt);
console.log('\n📋 Paste this into Supabase → Authentication → Providers → Apple → Secret Key (for OAuth)');
console.log(`⚠️  This JWT expires in 6 months (around ${new Date(exp * 1000).toDateString()}). Regenerate before then.\n`);

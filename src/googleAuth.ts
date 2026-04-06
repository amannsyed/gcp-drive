/**
 * Browser-side Google Service Account authentication.
 * Signs JWTs with Web Crypto API (RSA-SHA256) and exchanges them for
 * short-lived OAuth 2.0 access tokens — no Node.js or secret server needed.
 */

const TOKEN_CACHE: Record<string, { token: string; expiresAt: number }> = {};

/** Convert a PEM private key string to a CryptoKey */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers and whitespace
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');

  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** Base64url-encode a Uint8Array */
function b64url(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Build and sign a JWT for the given scopes */
async function signJwt(serviceAccount: any, scopes: string[]): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const enc = new TextEncoder();
  const headerB64 = b64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = b64url(enc.encode(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;

  const key = await importPrivateKey(serviceAccount.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    enc.encode(signingInput),
  );

  return `${signingInput}.${b64url(signature)}`;
}

/** Exchange a signed JWT for a Google OAuth 2.0 access token (with caching) */
export async function getAccessToken(serviceAccount: any): Promise<string> {
  const cacheKey = serviceAccount.client_email;
  const cached = TOKEN_CACHE[cacheKey];
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.token;
  }

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets',
  ];

  const jwt = await signJwt(serviceAccount, scopes);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.error_description || err.error || `Failed to get access token (${res.status})`,
    );
  }

  const data = await res.json();
  TOKEN_CACHE[cacheKey] = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

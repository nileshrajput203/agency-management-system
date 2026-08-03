import { createHmac, timingSafeEqual } from "crypto";

function getSecret(): string {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  return "agency-os-secret-key-change-in-prod";
}

function parseExpirySeconds(): number {
  const envVal = (process.env.JWT_EXPIRES_IN || "8h").trim().toLowerCase();
  if (/^\d+$/.test(envVal)) {
    return parseInt(envVal, 10);
  }
  if (envVal.endsWith("h")) {
    return parseInt(envVal, 10) * 3600;
  }
  if (envVal.endsWith("d")) {
    return parseInt(envVal, 10) * 86400;
  }
  if (envVal.endsWith("m")) {
    return parseInt(envVal, 10) * 60;
  }
  if (envVal.endsWith("s")) {
    return parseInt(envVal, 10);
  }
  return 8 * 3600; // default 8 hours
}

function base64url(input: string): string {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  [key: string]: unknown;
}

export interface RefreshTokenPayload {
  sub: string;
  type: "refresh";
  iat: number;
  exp: number;
}

export function signToken(userId: string): string {
  const secret = getSecret();
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const expirySeconds = parseExpirySeconds();
  const payload = base64url(
    JSON.stringify({ sub: userId, iat: now, exp: now + expirySeconds })
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): JwtPayload {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token format");
  }

  const secret = getSecret();
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token structure");
  }

  const [header, payload, signature] = parts as [string, string, string];

  // 1. Verify Header algorithm & type
  let headerObj: { alg?: string; typ?: string };
  try {
    headerObj = JSON.parse(decodeBase64url(header));
  } catch {
    throw new Error("Invalid token header format");
  }

  if (headerObj.alg !== "HS256" || (headerObj.typ && headerObj.typ !== "JWT")) {
    throw new Error("Unsupported token algorithm or type");
  }

  // 2. Timing-safe signature verification via binary digest comparison
  const expectedDigestBuffer = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest();

  let signatureBuffer: Buffer;
  try {
    signatureBuffer = Buffer.from(signature, "base64url");
  } catch {
    throw new Error("Invalid signature format");
  }

  if (
    signatureBuffer.length !== expectedDigestBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedDigestBuffer)
  ) {
    throw new Error("Invalid signature");
  }

  // 3. Verify Payload
  let data: JwtPayload;
  try {
    data = JSON.parse(decodeBase64url(payload)) as JwtPayload;
  } catch {
    throw new Error("Invalid token payload format");
  }

  if (!data) {
    throw new Error("Malformed token payload structure");
  }

  const userId = data.sub || (data as any).userId;
  if (!userId || typeof userId !== "string") {
    throw new Error("Malformed token payload structure: missing user identifier");
  }

  data.sub = userId;

  const now = Math.floor(Date.now() / 1000);
  if (typeof data.exp === "number" && data.exp < now) {
    throw new Error("Token expired");
  }

  return data;
}

/**
 * Architecture helper prepared for future refresh token support.
 * Not exposed via HTTP endpoints yet to prevent breaking changes.
 */
function parseRefreshTokenExpirySeconds(): number {
  const envVal = (process.env.JWT_REFRESH_EXPIRES_IN || "7d").trim().toLowerCase();
  if (/^\d+$/.test(envVal)) {
    return parseInt(envVal, 10);
  }
  if (envVal.endsWith("d")) {
    return parseInt(envVal, 10) * 86400;
  }
  if (envVal.endsWith("h")) {
    return parseInt(envVal, 10) * 3600;
  }
  if (envVal.endsWith("m")) {
    return parseInt(envVal, 10) * 60;
  }
  if (envVal.endsWith("s")) {
    return parseInt(envVal, 10);
  }
  return 7 * 86400; // default 7 days
}

export function signRefreshToken(
  userId: string,
  expiresInSeconds?: number
): string {
  const secret = getSecret();
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const expiry = expiresInSeconds ?? parseRefreshTokenExpirySeconds();
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      type: "refresh",
      iat: now,
      exp: now + expiry,
    })
  );
  const signature = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token format");
  }
  const payload = verifyToken(token);
  if (payload.type !== "refresh") {
    throw new Error("Invalid refresh token type");
  }
  return payload as RefreshTokenPayload;
}


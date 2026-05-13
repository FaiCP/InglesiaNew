import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "church-admin-session";
const DEFAULT_EMAIL = "admin@iglesia.local";
const DEFAULT_PASSWORD = "admin1234";
const DEFAULT_SECRET = "dev-secret-change-me";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type AdminSession = {
  email: string;
  exp: number;
};

function getAuthSecret() {
  return process.env.AUTH_SECRET || DEFAULT_SECRET;
}

function getAdminEmail() {
  return process.env.ADMIN_EMAIL || DEFAULT_EMAIL;
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || DEFAULT_PASSWORD;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

export function createSessionCookie(email: string) {
  const payload: AdminSession = {
    email,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySessionCookie(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSession;

    if (parsed.email !== getAdminEmail()) {
      return null;
    }

    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function validateAdminCredentials(email: string, password: string) {
  return email === getAdminEmail() && password === getAdminPassword();
}

export function parseCookieHeader(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }

  const pairs = cookieHeader.split(";").map((part) => part.trim());
  const match = pairs.find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!match) {
    return null;
  }

  return decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
}

export function isAdminRequest(request: Request) {
  const token = parseCookieHeader(request.headers.get("cookie"));
  return verifySessionCookie(token);
}

export function adminCookieName() {
  return COOKIE_NAME;
}

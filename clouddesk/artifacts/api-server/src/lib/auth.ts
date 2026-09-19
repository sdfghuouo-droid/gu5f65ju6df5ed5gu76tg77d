import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const COOKIE_NAME = "cd_session";

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "clouddesk-dev-secret-change-me";
}

export function isOpenMode(): boolean {
  const hash = process.env.AUTH_PASSWORD_HASH;
  return !hash || hash === "" || hash === "null" || hash === "false";
}

function getPasswordHash(): string {
  return process.env.AUTH_PASSWORD_HASH ?? "";
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signToken(user: string): string {
  const exp = Date.now() + Number(process.env.AUTH_SESSION_LIFETIME_MS ?? 7 * 24 * 60 * 60 * 1000);
  const body = Buffer.from(JSON.stringify({ user, exp })).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(parts[0]).digest("base64url");
  if (!constantTimeEqual(parts[1], expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as {
      user?: unknown;
      exp?: unknown;
    };
    if (typeof payload.user !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload.user;
  } catch {
    return null;
  }
}

export function setSessionCookie(req: Request, res: Response, user: string): void {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  const maxAge = Number(process.env.AUTH_SESSION_LIFETIME_MS ?? 7 * 24 * 60 * 60 * 1000);
  res.cookie(COOKIE_NAME, signToken(user), {
    httpOnly: true,
    secure,
    sameSite: "none",
    path: "/",
    maxAge,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function getSessionUser(req: Request): string | null {
  return verifyToken((req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME]);
}

/** Dashboard auth guard. Skips enforcement in open mode (no password configured). */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isOpenMode()) {
    next();
    return;
  }
  if (!getSessionUser(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function checkCredentials(username: unknown, password: unknown): boolean {
  if (typeof username !== "string" || typeof password !== "string") return false;
  const expectedUser = process.env.AUTH_USER ?? "admin";
  if (!constantTimeEqual(username, expectedUser)) return false;
  const hash = getPasswordHash();
  if (!hash || hash === "null" || hash === "false") return true;
  return constantTimeEqual(sha256Hex(password), hash.toLowerCase());
}

export { COOKIE_NAME, getPasswordHash };
import { Router, type Request, type Response } from "express";
import {
  checkCredentials,
  clearSessionCookie,
  getSessionUser,
  isOpenMode,
  setSessionCookie,
} from "../lib/auth";

const router = Router();

router.post("/login", (req: Request, res: Response) => {
  const { username, password } = (req.body ?? {}) as { username?: unknown; password?: unknown };

  if (!checkCredentials(username, password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  setSessionCookie(req, res, String(username));
  res.json({ username, message: "Login successful" });
});

router.post("/logout", (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ message: "Logged out" });
});

router.get("/me", (req: Request, res: Response) => {
  if (isOpenMode()) {
    res.json({ username: process.env.AUTH_USER ?? "admin" });
    return;
  }
  const user = getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({ username: user });
});

export default router;
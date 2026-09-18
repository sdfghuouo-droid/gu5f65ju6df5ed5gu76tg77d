import { Router, type Request, type Response } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq, ilike, or, and, type SQL } from "drizzle-orm";
import crypto from "crypto";
import {
  RegisterClientBody,
  UpdateClientBody,
  ListClientsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/clients", async (req: Request, res: Response) => {
  const parsed = ListClientsQueryParams.safeParse(req.query);
  const { status, search, group } = parsed.success
    ? parsed.data
    : { status: undefined, search: undefined, group: undefined };

  const conditions: SQL[] = [];
  if (status) conditions.push(eq(clientsTable.status, status));
  if (group) conditions.push(eq(clientsTable.group, group));
  if (search) {
    const like = or(
      ilike(clientsTable.hostname, `%${search}%`),
      ilike(clientsTable.username, `%${search}%`),
      ilike(clientsTable.ipAddress, `%${search}%`),
      ilike(clientsTable.os, `%${search}%`),
    );
    if (like) conditions.push(like);
  }

  const clients =
    conditions.length > 0
      ? await db
          .select()
          .from(clientsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : await db.select().from(clientsTable);

  res.json(
    clients.map((c) => ({ ...c, agentToken: undefined })),
  );
});

router.post("/clients/register", async (req: Request, res: Response) => {
  const parsed = RegisterClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid registration data" });
    return;
  }

  const token = crypto.randomUUID();
  const { hostname, username, os, agentVersion, ipAddress } = parsed.data;

  const [client] = await db
    .insert(clientsTable)
    .values({
      hostname,
      username: username ?? null,
      os: os ?? null,
      agentVersion: agentVersion ?? null,
      ipAddress: ipAddress ?? null,
      agentToken: token,
      status: "online",
      lastSeen: new Date(),
    })
    .returning({ id: clientsTable.id });

  res.status(201).json({ clientId: client.id, token });
});

router.get("/clients/:id", async (req: Request<{ id: string }>, res: Response) => {
  const [client] = await db
    .select()
    .from(clientsTable)
    .where(eq(clientsTable.id, req.params.id));

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json({ ...client, agentToken: undefined });
});

router.put("/clients/:id", async (req: Request<{ id: string }>, res: Response) => {
  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid update data" });
    return;
  }

  const updates: Partial<typeof clientsTable.$inferInsert> = {};
  if (parsed.data.group !== undefined) updates.group = parsed.data.group;
  if (parsed.data.tags !== undefined) updates.tags = parsed.data.tags;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;

  const [updated] = await db
    .update(clientsTable)
    .set(updates)
    .where(eq(clientsTable.id, req.params.id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Client not found" });
    return;
  }
  res.json({ ...updated, agentToken: undefined });
});

router.delete("/clients/:id", async (req: Request<{ id: string }>, res: Response) => {
  await db.delete(clientsTable).where(eq(clientsTable.id, req.params.id));
  res.status(204).send();
});

export default router;

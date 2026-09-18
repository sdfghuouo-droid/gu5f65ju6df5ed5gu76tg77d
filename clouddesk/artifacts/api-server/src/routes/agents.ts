import { Router, type Request, type Response } from "express";
import { db, clientsTable, commandsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { AgentHeartbeatBody } from "@workspace/api-zod";

const router = Router();

router.post("/agents/heartbeat", async (req: Request, res: Response) => {
  const parsed = AgentHeartbeatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid heartbeat data" });
    return;
  }

  const { clientId, token, cpu, ram, ramTotal, disk, diskTotal, ipAddress } =
    parsed.data;

  const [client] = await db
    .select({ id: clientsTable.id, agentToken: clientsTable.agentToken })
    .from(clientsTable)
    .where(eq(clientsTable.id, clientId));

  if (!client || client.agentToken !== token) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await db
    .update(clientsTable)
    .set({
      cpu: cpu ?? null,
      ram: ram ?? null,
      ramTotal: ramTotal ?? null,
      disk: disk ?? null,
      diskTotal: diskTotal ?? null,
      ipAddress: ipAddress ?? null,
      status: "online",
      lastSeen: new Date(),
    })
    .where(eq(clientsTable.id, clientId));

  const pendingCommands = await db
    .select()
    .from(commandsTable)
    .where(
      and(
        eq(commandsTable.clientId, clientId),
        inArray(commandsTable.status, ["pending"]),
      ),
    );

  if (pendingCommands.length > 0) {
    await db
      .update(commandsTable)
      .set({ status: "running" })
      .where(
        and(
          eq(commandsTable.clientId, clientId),
          inArray(commandsTable.status, ["pending"]),
        ),
      );
  }

  res.json({ pendingCommands });
});

router.post("/agents/command-result", async (req: Request, res: Response) => {
  const { commandId, clientToken, output, exitCode, status } = req.body as {
    commandId: string;
    clientToken: string;
    output: string;
    exitCode: number;
    status: "completed" | "failed" | "timeout";
  };

  const [command] = await db
    .select({ id: commandsTable.id, clientId: commandsTable.clientId })
    .from(commandsTable)
    .where(eq(commandsTable.id, commandId));

  if (!command) {
    res.status(404).json({ error: "Command not found" });
    return;
  }

  const [client] = await db
    .select({ agentToken: clientsTable.agentToken })
    .from(clientsTable)
    .where(eq(clientsTable.id, command.clientId));

  if (!client || client.agentToken !== clientToken) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await db
    .update(commandsTable)
    .set({ output, exitCode, status, completedAt: new Date() })
    .where(eq(commandsTable.id, commandId));

  res.json({ ok: true });
});

export default router;

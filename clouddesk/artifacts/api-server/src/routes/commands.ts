import { Router, type Request, type Response } from "express";
import { db, commandsTable, clientsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { RunCommandBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

// List commands for a client (last 50)
router.get("/", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;
  const commands = await db
    .select()
    .from(commandsTable)
    .where(eq(commandsTable.clientId, id))
    .orderBy(desc(commandsTable.createdAt))
    .limit(50);

  res.json(commands);
});

// Run a command on a client
router.post("/", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  const parsed = RunCommandBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid command data" });
    return;
  }

  const [client] = await db
    .select({ id: clientsTable.id, status: clientsTable.status })
    .from(clientsTable)
    .where(eq(clientsTable.id, id));

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const [command] = await db
    .insert(commandsTable)
    .values({
      clientId: id,
      command: parsed.data.command,
      status: "pending",
    })
    .returning();

  if (client.status === "offline" || client.status === "maintenance") {
    const [updated] = await db
      .update(commandsTable)
      .set({
        status: "failed",
        output: `Client is ${client.status}. Cannot execute command.`,
        completedAt: new Date(),
      })
      .where(eq(commandsTable.id, command.id))
      .returning();
    res.status(202).json(updated);
    return;
  }

  res.status(202).json(command);
});

// Get a specific command
router.get(
  "/:cmdId",
  async (req: Request<{ id: string; cmdId: string }>, res: Response) => {
    const { id, cmdId } = req.params;
    const [command] = await db
      .select()
      .from(commandsTable)
      .where(and(eq(commandsTable.id, cmdId), eq(commandsTable.clientId, id)));

    if (!command) {
      res.status(404).json({ error: "Command not found" });
      return;
    }
    res.json(command);
  },
);

export default router;

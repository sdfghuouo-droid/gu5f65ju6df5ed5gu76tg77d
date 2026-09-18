import { Router, type Request, type Response } from "express";
import { db, clientsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/stats", async (_req: Request, res: Response) => {
  const rows = await db
    .select({
      status: clientsTable.status,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(clientsTable)
    .groupBy(clientsTable.status);

  const counts: Record<string, number> = {
    online: 0,
    offline: 0,
    alerting: 0,
    maintenance: 0,
  };
  let total = 0;
  for (const row of rows) {
    counts[row.status] = row.count;
    total += row.count;
  }

  res.json({ total, ...counts });
});

export default router;

import { Router, type Request, type Response } from "express";
import { db, clientsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router({ mergeParams: true });

router.get("/", async (req: Request<{ id: string }>, res: Response) => {
  const { id } = req.params;

  const [client] = await db
    .select({
      id: clientsTable.id,
      status: clientsTable.status,
      os: clientsTable.os,
    })
    .from(clientsTable)
    .where(eq(clientsTable.id, id));

  if (!client) {
    res.status(404).json({ error: "Client not found" });
    return;
  }

  const isWindows = client.os?.toLowerCase().includes("windows") ?? true;
  const now = new Date().toISOString();

  const files = isWindows
    ? [
        { name: "Users", path: "C:\\Users", isDirectory: true, size: null, modifiedAt: now },
        { name: "Program Files", path: "C:\\Program Files", isDirectory: true, size: null, modifiedAt: now },
        { name: "Windows", path: "C:\\Windows", isDirectory: true, size: null, modifiedAt: now },
        { name: "Temp", path: "C:\\Temp", isDirectory: true, size: null, modifiedAt: now },
        { name: "pagefile.sys", path: "C:\\pagefile.sys", isDirectory: false, size: 1073741824, modifiedAt: now },
        { name: "hiberfil.sys", path: "C:\\hiberfil.sys", isDirectory: false, size: 536870912, modifiedAt: now },
      ]
    : [
        { name: "home", path: "/home", isDirectory: true, size: null, modifiedAt: now },
        { name: "etc", path: "/etc", isDirectory: true, size: null, modifiedAt: now },
        { name: "var", path: "/var", isDirectory: true, size: null, modifiedAt: now },
        { name: "usr", path: "/usr", isDirectory: true, size: null, modifiedAt: now },
        { name: "tmp", path: "/tmp", isDirectory: true, size: null, modifiedAt: now },
      ];

  res.json(files);
});

export default router;

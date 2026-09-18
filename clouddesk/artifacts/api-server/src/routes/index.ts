import { Router, type IRouter } from "express";
import healthRouter from "./health";
import statsRouter from "./stats";
import clientsRouter from "./clients";
import commandsRouter from "./commands";
import filesRouter from "./files";
import agentsRouter from "./agents";

const router: IRouter = Router();

router.use(healthRouter);
router.use(statsRouter);
router.use(clientsRouter);
router.use("/clients/:id/commands", commandsRouter);
router.use("/clients/:id/files", filesRouter);
router.use(agentsRouter);

export default router;

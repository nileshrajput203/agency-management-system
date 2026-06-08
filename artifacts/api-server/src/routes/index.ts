import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import dashboardRouter from "./dashboard";
import clientsRouter from "./clients";
import leadsRouter from "./leads";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import contentRouter from "./content";
import invoicesRouter from "./invoices";
import quotationsRouter from "./quotations";
import usersRouter from "./users";
import attendanceRouter from "./attendance";
import leavesRouter from "./leaves";
import proposalsRouter from "./proposals";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(dashboardRouter);
router.use(clientsRouter);
router.use(leadsRouter);
router.use(projectsRouter);
router.use(tasksRouter);
router.use(contentRouter);
router.use(invoicesRouter);
router.use(quotationsRouter);
router.use(usersRouter);
router.use(attendanceRouter);
router.use(leavesRouter);
router.use(proposalsRouter);
router.use(settingsRouter);

export default router;

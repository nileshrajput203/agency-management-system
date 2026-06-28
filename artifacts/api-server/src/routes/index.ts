import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import clientsRouter from "./clients";
import leadsRouter from "./leads";
import projectsRouter from "./projects";
import tasksRouter from "./tasks";
import contentRouter from "./content";
import invoicesRouter from "./invoices";
import quotationsRouter from "./quotations";
import proposalsRouter from "./proposals";
import usersRouter from "./users";
import dashboardRouter from "./dashboard";
import attendanceRouter from "./attendance";
import leavesRouter from "./leaves";
import settingsRouter from "./settings";
import proformaInvoicesRouter from "./proforma-invoices";
import purchaseOrdersRouter from "./purchase-orders";
import deliveryChallansRouter from "./delivery-challans";
import socialAccountsRouter from "./social-accounts";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth);

router.use("/clients", clientsRouter);
router.use("/leads", leadsRouter);
router.use("/projects", projectsRouter);
router.use("/tasks", tasksRouter);
router.use("/content-posts", contentRouter);
router.use("/invoices", invoicesRouter);
router.use("/quotations", quotationsRouter);
router.use("/proposals", proposalsRouter);
router.use("/users", usersRouter);
router.use("/dashboard", dashboardRouter);
router.use(attendanceRouter);
router.use(leavesRouter);
router.use(settingsRouter);
router.use("/proforma-invoices", proformaInvoicesRouter);
router.use("/purchase-orders", purchaseOrdersRouter);
router.use("/delivery-challans", deliveryChallansRouter);
router.use("/social-accounts", socialAccountsRouter);

export default router;

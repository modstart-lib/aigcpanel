import { Router } from "express";
import modelRoutes from "./model";
import workflowRoutes from "./workflow";
import taskRoutes from "./task";

const router = Router();

router.use("/api/model", modelRoutes);
router.use("/api/workflow", workflowRoutes);
router.use("/api/task", taskRoutes);

export default router;

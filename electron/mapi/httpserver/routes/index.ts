import { Router } from "express";
import serverRoutes from "./server";
import modelRoutes from "./model";
import workflowRoutes from "./workflow";
import toolsRoutes from "./tools";
import uploadRoutes from "./upload";
import fileRoutes from "./file";
import liveRoutes from "./live";

const router = Router();

router.use("/api/server", serverRoutes);
router.use("/api/model", modelRoutes);
router.use("/api/workflow", workflowRoutes);
router.use("/api/tools", toolsRoutes);
router.use("/api/upload", uploadRoutes);
router.use("/api/file", fileRoutes);
router.use("/api/live", liveRoutes);

export default router;

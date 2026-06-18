import { Router, type IRouter } from "express";
import healthRouter from "./health";
import buildingsRouter from "./buildings";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(buildingsRouter);
router.use(eventsRouter);

export default router;

import express from "express";

import {
  createWaterLevel,
  getWaterLevels,
  getLatestWaterLevel,
  getDailyWaterLevelHistory,
  deleteDailyWaterLevelHistory,
  getWaterLevelAnalytics,
} from "../controllers/waterLevelController.js";

const router = express.Router();

router.post("/", createWaterLevel);

router.get("/", getWaterLevels);

router.get(
  "/history/daily",
  getDailyWaterLevelHistory
);

router.delete(
  "/history/daily/:id",
  deleteDailyWaterLevelHistory
);

router.get(
  "/latest/:camera_id",
  getLatestWaterLevel
);

router.get(
  "/analytics",
  getWaterLevelAnalytics
);

export default router;

const express = require("express");
const router = express.Router();

const EvacController = require("../controllers/EvacController.js");

router.post("/make", EvacController.createPlace);
router.get("/", EvacController.getPlaces);

router.get("/history/logs", EvacController.getHistory);
router.get("/analytics/summary", EvacController.getAnalyticsSummary);

router.put("/:id", EvacController.updatePlace);
router.put("/:id/status", EvacController.updateCapacityStatus);

router.delete("/:id", EvacController.deletePlace);

module.exports = router;

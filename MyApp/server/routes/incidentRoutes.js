const express = require("express");
const router = express.Router();
const incidentController = require("../controllers/incidentController");
const uploadIncidentImage = require("../middleware/incidentUpload"); 

// ✅ Get all incidents
router.get("/getIncidents", incidentController.getIncidents);
router.get('/stats', incidentController.getIncidentStats);
router.get('/typeStats', incidentController.getIncidentTypeStats);
router.get('/trend', incidentController.getTrend);

// ✅ Register incident (single image) + prevent undefined body
router.post(
  "/register",
  (req, res, next) => {
    if (!req.body) req.body = {};
    next();
  },
  uploadIncidentImage.single("image"),
  incidentController.registerIncident
);

// ✅ Update status
router.put("/updateStatus/:id", incidentController.updateStatus);

// ✅ Delete incident
router.delete("/delete/:id", incidentController.deleteIncident);

module.exports = router;
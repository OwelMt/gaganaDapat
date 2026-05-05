const express = require("express");
const router = express.Router();
const incidentController = require("../controllers/incidentController");
const { uploadIncidentImage } = require("../middleware/upload");

// ✅ Get all incidents
router.get("/getIncidents", incidentController.getIncidents);
router.get("/history", incidentController.getIncidentHistory);
router.get("/stats", incidentController.getIncidentStats);
router.get("/typeStats", incidentController.getIncidentTypeStats);
router.get("/trend", incidentController.getTrend);

// ✅ Export single incident PDF
router.get("/export-pdf/:id", incidentController.exportIncidentPdf);

// ✅ Admin verification override
router.put("/updateVerification/:id", incidentController.updateVerification);

// ✅ Re-run AI verification
router.put("/reverify/:id", incidentController.reverifyIncident);

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

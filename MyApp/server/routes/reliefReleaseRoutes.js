const express = require("express");
const router = express.Router();
const controller = require("../controllers/reliefReleaseController");
const {
  requireLogin,
  requireAdminOrDrrmo,
} = require("../middleware/adminMiddleware");

router.get(
  "/approved-requests",
  requireLogin,
  requireAdminOrDrrmo,
  controller.getApprovedRequestsForRelease
);

router.post(
  "/",
  requireLogin,
  requireAdminOrDrrmo,
  controller.createReliefRelease
);

router.get(
  "/",
  requireLogin,
  requireAdminOrDrrmo,
  controller.getAllReliefReleases
);

router.get(
  "/:id/export-pdf",
  requireLogin,
  controller.exportReliefReleasePdf
);

router.put(
  "/:id/receive",
  requireLogin,
  controller.receiveReliefRelease
);

router.get(
  "/:reliefRequestId",
  requireLogin,
  requireAdminOrDrrmo,
  controller.getReleasesByRequest
);

module.exports = router;
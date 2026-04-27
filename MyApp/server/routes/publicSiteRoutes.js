const express = require("express");
const router = express.Router();

const controller = require("../controllers/publicSiteController");
const {
  requireLogin,
  requireAdminOrDrrmo,
} = require("../middleware/adminMiddleware");

/* =========================
   PUBLIC
========================= */

router.get("/", controller.getPublicSite);

/* =========================
   ADMIN / DRRMO EDIT
========================= */

router.put(
  "/",
  requireLogin,
  requireAdminOrDrrmo,
  controller.updatePublicSite
);

router.put(
  "/reset",
  requireLogin,
  requireAdminOrDrrmo,
  controller.resetPublicSite
);

router.put(
  "/incident-feed-mode",
  requireLogin,
  requireAdminOrDrrmo,
  controller.updateIncidentFeedMode
);

module.exports = router;

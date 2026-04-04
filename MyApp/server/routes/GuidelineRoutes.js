const express = require("express");
const router = express.Router();
const controller = require("../controllers/GuidelineController");
const { uploadGuideline } = require("../middleware/upload"); // uses the fixed guidelines folder

// Only uploads go into uploads/guidelines/
router.post("/", uploadGuideline.array("attachments"), controller.createGuideline);

router.get("/", controller.getGuidelines);
router.get("/:id", controller.getGuidelineById);

router.patch("/view/:id", controller.incrementViews);
router.put("/:id", controller.updateGuideline);
router.delete("/:id", controller.deleteGuideline);

module.exports = router;
You ran out of storage 20 days ago … Not enough storage. You can't save to Drive, back up to Photos or use Gmail. Get 30 GB for ₱10 for 3 months ₱49.
const mongoose = require("mongoose");

const yoloCommandSchema = new mongoose.Schema(
  {
    camera_id: {
      type: String,
      required: true,
      default: "cam_1",
      unique: true,
    },

    command: {
      type: String,
      enum: ["NONE", "START", "STOP"],
      default: "NONE",
    },

    desired_running: {
      type: Boolean,
      default: false,
    },

    actual_running: {
      type: Boolean,
      default: false,
    },

    last_seen_at: {
      type: Date,
      default: null,
    },

    last_started_at: {
      type: Date,
      default: null,
    },

    last_stopped_at: {
      type: Date,
      default: null,
    },

    message: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("YoloCommand", yoloCommandSchema);

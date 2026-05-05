const mongoose = require("mongoose");

const historySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["ADD", "STATUS_UPDATE", "VERIFICATION_UPDATE", "DELETE"],
      required: true,
    },
    placeName: {
      type: String,
      required: true,
    },
    details: String,
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

const HistoryModel = mongoose.model('History', historySchema);
module.exports = HistoryModel;

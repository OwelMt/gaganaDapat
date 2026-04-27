const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    type: String,
    level: String,
    location: String,
    description: String,
    latitude: Number,
    longitude: Number,
    status: { type: String, default: "reported" },

    image: {
      fileName: String,
      fileUrl: String,
      public_id: String,
    },

    // auto-expire after 7 days
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      index: { expires: 0 },
    },

    // 🔥 FULL AI VERIFICATION DATA
    verification: {
      status: {
        type: String,
        enum: ["approved", "pending", "rejected"],
        default: "pending"
      },

      confidence: Number,

      labels: [String],          // all detected labels
      matchedLabels: [String],   // labels relevant to incident type

      isMatch: Boolean,          // whether labels matched rules

      score: Number,             // 🔥 weighted score (labels + metadata)

      reasoning: String,         // 🔥 human-friendly explanation

      metadata: {
        hasGPS: Boolean,
        isRecent: Boolean,
        isWithinArea: Boolean,
        device: String,
        width: Number,
        height: Number,
        timestamp: Number,
      }
    },

    usernames: { 
      type: String, 
      ref: "User" 
    },

    phone: { 
      type: String, 
      ref: "User" 
    }
  },
  { timestamps: true }
);

const IncidentModel = mongoose.model("Incident", incidentSchema);
module.exports = IncidentModel;

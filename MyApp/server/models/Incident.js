const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    type: String,
    level: String,
    location: String,
    description: String,
    latitude: Number,
    longitude: Number,

    status: {
      type: String,
      default: "reported",
    },

    // ✅ Reporter identity.
    // Needed so the original user can receive approval notifications.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reporterUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ✅ Public visibility flags.
    // Needed so admin approval can make the incident visible on mobile/public map.
    isPublic: {
      type: Boolean,
      default: false,
    },

    approvedByMDRRMO: {
      type: Boolean,
      default: false,
    },

    forceApproved: {
      type: Boolean,
      default: false,
    },

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
        default: "pending",
      },

      confidence: Number,

      labels: [String],
      matchedLabels: [String],

      isMatch: Boolean,

      score: Number,

      reasoning: String,

      metadata: {
        hasGPS: Boolean,
        isRecent: Boolean,
        isWithinArea: Boolean,
        device: String,
        width: Number,
        height: Number,
        timestamp: Number,
      },
    },

    usernames: {
      type: String,
      ref: "User",
    },

    phone: {
      type: String,
      ref: "User",
    },
  },
  { timestamps: true }
);

const IncidentModel = mongoose.model("Incident", incidentSchema);

module.exports = IncidentModel;
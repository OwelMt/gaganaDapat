const mongoose = require("mongoose");

const requestRowSchema = new mongoose.Schema(
  {
    evacPlaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EvacPlace",
      default: null,
    },

    evacuationCenterName: {
      type: String,
      required: true,
      trim: true,
    },

    households: {
      type: Number,
      default: 0,
      min: 0,
    },

    families: {
      type: Number,
      default: 0,
      min: 0,
    },

    male: {
      type: Number,
      default: 0,
      min: 0,
    },

    female: {
      type: Number,
      default: 0,
      min: 0,
    },

    lgbtq: {
      type: Number,
      default: 0,
      min: 0,
    },

    pwd: {
      type: Number,
      default: 0,
      min: 0,
    },

    pregnant: {
      type: Number,
      default: 0,
      min: 0,
    },

    senior: {
      type: Number,
      default: 0,
      min: 0,
    },

    requestedFoodPacks: {
      type: Number,
      default: 0,
      min: 0,
    },

    isActiveRow: {
      type: Boolean,
      default: true,
    },
    rowRemarks: {
      type: String,
      default: "",
      trim: true,
    },

  },
  { _id: false }
);

const reliefRequestSchema = new mongoose.Schema(
  {
    requestNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    barangayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barangay",
      required: true,
    },

    barangayName: {
      type: String,
      required: true,
      trim: true,
    },

    disaster: {
      type: String,
      required: true,
      trim: true,
    },

    requestDate: {
      type: Date,
      default: Date.now,
    },

    rows: {
      type: [requestRowSchema],
      default: [],
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one evacuation center row is required.",
      },
    },

    totals: {
      households: { type: Number, default: 0, min: 0 },
      families: { type: Number, default: 0, min: 0 },
      male: { type: Number, default: 0, min: 0 },
      female: { type: Number, default: 0, min: 0 },
      lgbtq: { type: Number, default: 0, min: 0 },
      pwd: { type: Number, default: 0, min: 0 },
      pregnant: { type: Number, default: 0, min: 0 },
      senior: { type: Number, default: 0, min: 0 },
      requestedFoodPacks: { type: Number, default: 0, min: 0 },
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "partially_released",
        "released",
        "received",
        "cancelled",
      ],
      default: "pending",
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    approvedBy: {
      type: String,
      default: "",
      trim: true,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedBy: {
      type: String,
      default: "",
      trim: true,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: "",
      trim: true,
    },

    releasedBy: {
      type: String,
      default: "",
      trim: true,
    },

    releasedAt: {
      type: Date,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    emailSent: {
      type: Boolean,
      default: false,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },
    currentStage: {
      type: String,
      enum: [
    "preparation",
    "pending_review",
    "rejected",
    "approved_waiting_release",
    "partially_released",
    "released_waiting_receipt",
    "completed"
  ],
  default: "pending_review"
},

entryMode: {
  type: String,
  enum: ["manual", "excel_import", "system_bootstrap"],
  default: "system_bootstrap"
},

rowSource: {
  type: String,
  enum: ["evac_place_snapshot", "manual_override"],
  default: "evac_place_snapshot"
},

approvalRemarks: {
  type: String,
  default: "",
  trim: true,
},
releaseNotes: {
  type: String,
  default: "",
  trim: true,
},

isEditedAfterSubmit: {
  type: Boolean,
  default: false,
},

lastEditedAt: {
  type: Date,
  default: null,
},

editCount: {
  type: Number,
  default: 0,
  min: 0,
},

lastEditedBy: {
  type: String,
  default: "",
  trim: true,
},


fulfillment: {
  totalReleases: { type: Number, default: 0, min: 0 },
  releasedFoodPacks: { type: Number, default: 0, min: 0 },
  receivedReleases: { type: Number, default: 0, min: 0 },
  pendingReleases: { type: Number, default: 0, min: 0 },
  lastReleaseAt: { type: Date, default: null },
},

prioritySnapshot: {
  totalAffected: { type: Number, default: 0, min: 0 },
  vulnerableCount: { type: Number, default: 0, min: 0 },
  priorityScore: { type: Number, default: 0, min: 0 },
},

  },
  { timestamps: true }
);

reliefRequestSchema.pre("save", function () {
  const rows = this.rows || [];

  

  this.totals = {
    households: rows.reduce((sum, row) => sum + (Number(row.households) || 0), 0),
    families: rows.reduce((sum, row) => sum + (Number(row.families) || 0), 0),
    male: rows.reduce((sum, row) => sum + (Number(row.male) || 0), 0),
    female: rows.reduce((sum, row) => sum + (Number(row.female) || 0), 0),
    lgbtq: rows.reduce((sum, row) => sum + (Number(row.lgbtq) || 0), 0),
    pwd: rows.reduce((sum, row) => sum + (Number(row.pwd) || 0), 0),
    pregnant: rows.reduce((sum, row) => sum + (Number(row.pregnant) || 0), 0),
    senior: rows.reduce((sum, row) => sum + (Number(row.senior) || 0), 0),
    requestedFoodPacks: rows.reduce(
      (sum, row) => sum + (Number(row.requestedFoodPacks) || 0),
      0
    ),
  };

});

module.exports = mongoose.model("ReliefRequest", reliefRequestSchema);

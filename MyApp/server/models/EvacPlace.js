const mongoose = require("mongoose");

const placeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },

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

    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },

    // Capacity
    capacityIndividual: { type: Number, required: true, min: 0 },
    capacityFamily: { type: Number, required: true, min: 0 },
    bedCapacity: { type: Number, default: 0, min: 0 },

    // Infrastructure
    floorArea: { type: Number, default: 0, min: 0 },

    // Facilities
    femaleCR: { type: Boolean, default: false },
    maleCR: { type: Boolean, default: false },
    commonCR: { type: Boolean, default: false },

    potableWater: { type: Boolean, default: false },
    nonPotableWater: { type: Boolean, default: false },

    // Flags
    isPermanent: { type: Boolean, default: false },
    isCovidFacility: { type: Boolean, default: false },

    // Status
    capacityStatus: {
      type: String,
      enum: ["available", "limited", "full"],
      default: "available",
    },

    remarks: {
      type: String,
      default: "",
      trim: true,
    },

    isArchived: {
      type: Boolean,
      default: false,
    },

    archivedAt: {
      type: Date,
      default: null,
    },

    isRequestVisible: {
  type: Boolean,
  default: true,
},
  },
  { timestamps: true }
);

placeSchema.index(
  { barangayId: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isArchived: false },
  }
);

module.exports = mongoose.model("EvacPlace", placeSchema);
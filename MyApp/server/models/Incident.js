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

    // ⏰ auto-expire after 24 hours
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
      index: { expires: 0 },
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
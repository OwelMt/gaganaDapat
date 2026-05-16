const PDFDocument = require("pdfkit");
const axios = require("axios");
const IncidentModel = require("../models/Incident");
const HistoryModel = require("../models/History");
const Notification = require("../models/Notification");
const createNotification = require("../utils/createNotification");
const cloudinary = require("../config/cloudinary");

const exif = require("exif-parser");
const { verifyIncidentImage } = require("../utils/verifyIncidentImage");
const INCIDENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AUTO_VERIFY_INTERVAL_MS = 2 * 60 * 1000;
const AUTO_VERIFY_BATCH_SIZE = 5;

const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeRole = (value) => {
  return normalizeString(value).toLowerCase();
};

const safeLower = (value) => normalizeString(value).toLowerCase();

const formatDateValue = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatLabel = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return "-";

  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const drawPdfLabelValue = (doc, label, value) => {
  doc.font("Helvetica-Bold").text(`${label}: `, { continued: true });
  doc.font("Helvetica").text(value ?? "-");
};

const ensurePdfPageSpace = (doc, neededSpace = 80) => {
  if (doc.y + neededSpace > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
};

const drawPdfSectionTitle = (doc, title) => {
  ensurePdfPageSpace(doc, 40);
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(13).text(title);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10);
};

const generateReasoning = (v) => {
  if (!v) return "No verification data";

  if (!v.isMatch) {
    return "Rejected: Image does not match the reported incident type.";
  }

  if (!v.metadata?.gps && !v.metadata?.timestamp) {
    return "Weak evidence: Missing GPS and timestamp metadata.";
  }

  if (!v.metadataFlags?.isWithinArea) {
    return "Outside monitored area (Jaen).";
  }

  if (!v.metadataFlags?.isRecent) {
    return "Image is not recent (older than 24 hours).";
  }

  if (v.status === "approved") {
    return `Approved: High confidence (${v.confidence}%) with labels: ${v.matchedLabels.join(", ")}`;
  }

  return `Pending: Partial match (${v.confidence}%) — needs manual review.`;
};

const buildStoredVerification = (verification) => {
  if (!verification) return undefined;

  return {
    status: verification.status || "pending",
    confidence: verification.confidence || 0,
    labels: verification.labels || [],
    matchedLabels: verification.matchedLabels || [],
    isMatch: verification.isMatch || false,
    score: verification.confidence || 0,
    reasoning: generateReasoning(verification),
    metadata: {
      hasGPS: verification.metadataFlags?.hasLocation || false,
      isRecent: verification.metadataFlags?.isRecent || false,
      isWithinArea: verification.metadataFlags?.isWithinArea || false,
      device: verification.metadata?.device || null,
      width: verification.metadata?.width || null,
      height: verification.metadata?.height || null,
      timestamp: verification.metadata?.timestamp || null,
    },
  };
};

const applyVerificationOutcome = (incident, verificationResult) => {
  if (!incident || !verificationResult) return incident;

  incident.verification = buildStoredVerification(verificationResult);

  const status = normalizeString(incident.verification?.status).toLowerCase();

  if (status === "approved") {
    incident.set("isPublic", true);
    incident.set("approvedByMDRRMO", true);
    incident.set("forceApproved", true);
  } else if (status === "rejected") {
    incident.set("isPublic", false);
    incident.set("approvedByMDRRMO", false);
    incident.set("forceApproved", false);

    if (normalizeString(incident.status).toLowerCase() === "approved") {
      incident.status = "reported";
    }
  } else {
    incident.set("isPublic", false);
    incident.set("approvedByMDRRMO", false);
    incident.set("forceApproved", false);
  }

  return incident;
};

const hasVerificationEvidence = (verification = {}) => {
  if (!verification || typeof verification !== "object") return false;

  const labels = Array.isArray(verification.labels) ? verification.labels : [];
  const matchedLabels = Array.isArray(verification.matchedLabels)
    ? verification.matchedLabels
    : [];
  const metadata = verification.metadata || {};

  return Boolean(
    normalizeString(verification.reasoning) ||
      verification.confidence !== undefined ||
      verification.score !== undefined ||
      labels.length ||
      matchedLabels.length ||
      metadata.timestamp ||
      metadata.device ||
      metadata.hasGPS !== undefined ||
      metadata.isRecent !== undefined ||
      metadata.isWithinArea !== undefined
  );
};

const needsIncidentAutoVerification = (incident = {}) => {
  if (!incident?.image?.fileUrl) return false;

  const verification = incident.verification || null;
  if (!verification) return true;

  const status = normalizeString(verification.status).toLowerCase();
  if (!status) return true;
  if (status === "approved" || status === "rejected") return false;

  return !hasVerificationEvidence(verification);
};

const verifyIncidentFromImageUrl = async (incident) => {
  if (!incident?.image?.fileUrl) return null;

  const response = await axios.get(incident.image.fileUrl, {
    responseType: "arraybuffer",
  });

  const buffer = Buffer.from(response.data);
  return verifyIncidentImage(buffer, incident.type);
};

let pendingIncidentVerifierStarted = false;
let pendingIncidentVerifierRunning = false;

const verifyPendingIncidentsBatch = async () => {
  if (pendingIncidentVerifierRunning) return;
  pendingIncidentVerifierRunning = true;

  try {
    const incidents = await IncidentModel.find({
      "image.fileUrl": { $exists: true, $ne: "" },
      $or: [
        { verification: { $exists: false } },
        { "verification.reasoning": { $exists: false } },
        { "verification.reasoning": "" },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(AUTO_VERIFY_BATCH_SIZE);

    for (const incident of incidents) {
      if (!needsIncidentAutoVerification(incident)) continue;

      try {
        const verificationResult = await verifyIncidentFromImageUrl(incident);
        if (!verificationResult) continue;

        applyVerificationOutcome(incident, verificationResult);
        await incident.save();

        if (normalizeString(incident.verification?.status).toLowerCase() === "approved") {
          await notifyReporterIncidentApprovedOnce({
            req: { session: {}, body: {} },
            incident,
          });
        }
      } catch (error) {
        console.error("Background incident auto-verification error:", {
          incidentId: String(incident?._id || ""),
          message: error?.message || error,
        });
      }
    }
  } catch (error) {
    console.error("Pending incident verifier batch failed:", error);
  } finally {
    pendingIncidentVerifierRunning = false;
  }
};

const ensurePendingIncidentVerifier = () => {
  if (pendingIncidentVerifierStarted) return;
  pendingIncidentVerifierStarted = true;

  setTimeout(() => {
    verifyPendingIncidentsBatch().catch((error) => {
      console.error("Initial pending incident verifier failed:", error);
    });
  }, 15 * 1000);

  setInterval(() => {
    verifyPendingIncidentsBatch().catch((error) => {
      console.error("Scheduled pending incident verifier failed:", error);
    });
  }, AUTO_VERIFY_INTERVAL_MS);
};

ensurePendingIncidentVerifier();

// -----------------------------
// NOTIFICATION HELPERS
// -----------------------------
const getNotificationDayKey = () => {
  return new Date().toISOString().slice(0, 10);
};

const getActorMeta = (req) => {
  return {
    actorRole: normalizeRole(req.session?.role) || "system",
    actorUser: req.session?.userId || null,
    actorName:
      normalizeString(req.session?.username) ||
      normalizeString(req.session?.name) ||
      normalizeString(req.body?.usernames) ||
      "System",
  };
};

const getIncidentBarangayName = (req, incident = {}) => {
  return (
    normalizeString(incident.barangayName) ||
    normalizeString(incident.barangay) ||
    normalizeString(req.body?.barangayName) ||
    normalizeString(req.body?.barangay) ||
    normalizeString(req.session?.barangayName) ||
    ""
  );
};

const getIncidentBarangayId = (req, incident = {}) => {
  return (
    incident.barangayId ||
    incident.barangay ||
    req.body?.barangayId ||
    req.session?.barangayId ||
    null
  );
};

const getIncidentRecipientLink = () => {
  return "/drrmo/incident-report";
};

const getIncidentRecipientsForActor = () => {
  return [{ role: "drrmo" }];
};

const buildIncidentNotificationPayload = ({
  eventType,
  incident,
  status = "",
}) => {
  const incidentType = formatLabel(incident?.type || "Incident");
  const level = formatLabel(incident?.level || "");
  const location = normalizeString(incident?.location) || "an unspecified location";
  const verificationStatus = normalizeString(incident?.verification?.status);
  const incidentStatus = normalizeString(status || incident?.status);

  if (eventType === "created") {
    const isCritical =
      normalizeRole(incident?.level) === "critical" ||
      normalizeRole(incident?.level) === "high";

    return {
      type: "incident_reported",
      priority: isCritical ? "critical" : "high",
      title: "New incident reported",
      message: `${incidentType} incident reported at ${location}${level ? ` with ${level} level` : ""}.`,
      alertReason: "created",
    };
  }

  if (eventType === "status") {
    return {
      type: "incident_status_updated",
      priority:
        incidentStatus === "resolved"
          ? "normal"
          : incidentStatus === "onProcess"
            ? "high"
            : "normal",
      title: "Incident status updated",
      message: `${incidentType} incident at ${location} was updated to ${formatLabel(incidentStatus)}.`,
      alertReason: "status_updated",
    };
  }

  if (eventType === "verification") {
    return {
      type: "incident_verification_updated",
      priority:
        verificationStatus === "rejected"
          ? "high"
          : verificationStatus === "approved"
            ? "normal"
            : "high",
      title: "Incident verification updated",
      message: `${incidentType} incident at ${location} verification was set to ${formatLabel(verificationStatus)}.`,
      alertReason: "verification_updated",
    };
  }

  if (eventType === "reverified") {
    return {
      type: "incident_reverified",
      priority:
        verificationStatus === "rejected"
          ? "high"
          : verificationStatus === "approved"
            ? "normal"
            : "high",
      title: "Incident image reverified",
      message: `${incidentType} incident at ${location} was reverified with result ${formatLabel(verificationStatus)}.`,
      alertReason: "reverified",
    };
  }

  if (eventType === "deleted") {
    return {
      type: "incident_deleted",
      priority: "high",
      title: "Incident report deleted",
      message: `${incidentType} incident at ${location} was deleted.`,
      alertReason: "deleted",
    };
  }

  return {
    type: "incident_activity",
    priority: "normal",
    title: "Incident activity",
    message: `${incidentType} incident at ${location} had an update.`,
    alertReason: "activity",
  };
};

const createIncidentNotificationForRecipientOnce = async ({
  req,
  incident,
  recipientRole,
  eventType,
  status = "",
  metadata = {},
}) => {
  try {
    if (!incident?._id || !recipientRole) return null;

    const { actorRole, actorUser, actorName } = getActorMeta(req);
    const dayKey = getNotificationDayKey();
    const barangayId = getIncidentBarangayId(req, incident);
    const barangayName = getIncidentBarangayName(req, incident);

    const payload = buildIncidentNotificationPayload({
      eventType,
      incident,
      status,
    });

    const existing = await Notification.findOne({
      recipientRole,
      module: "incident",
      type: payload.type,
      referenceId: incident._id,
      "metadata.dayKey": dayKey,
      "metadata.actorRole": actorRole,
    }).lean();

    if (existing) return existing;

    const recipientData = {
      recipientRole,
    };

    if (recipientRole === "barangay") {
      if (!barangayId && !barangayName) return null;

      recipientData.recipientUser = barangayId || null;
      recipientData.recipientUserModel = barangayId ? "Barangay" : null;
      recipientData.recipientBarangay = barangayId || null;
      recipientData.recipientBarangayName = barangayName || "";
    }

    return await createNotification({
      ...recipientData,

      senderUser: actorUser,
      senderRole: actorRole || "",
      senderName: actorName,

      module: "incident",
      type: payload.type,
      priority: payload.priority,

      title: payload.title,
      message: payload.message,
      link: getIncidentRecipientLink(recipientRole),

      referenceId: incident._id,
      referenceModel: "Incident",
      metadata: {
        dayKey,
        actorRole,
        actorName,
        alertReason: payload.alertReason,
        incidentId: incident._id,
        incidentType: incident.type || "",
        incidentLevel: incident.level || "",
        incidentStatus: incident.status || "",
        verificationStatus: incident.verification?.status || "",
        location: incident.location || "",
        barangayId: barangayId || null,
        barangayName: barangayName || "",
        latitude: incident.latitude || null,
        longitude: incident.longitude || null,
        ...metadata,
      },
    });
  } catch (err) {
    console.error("Create Incident Notification For Recipient Error:", err);
    return null;
  }
};

const notifyIncidentEvent = async ({
  req,
  incident,
  eventType,
  status = "",
  metadata = {},
}) => {
  try {
    if (!incident?._id) return;

    const recipients = getIncidentRecipientsForActor(req, incident);

    await Promise.all(
      recipients.map((recipient) =>
        createIncidentNotificationForRecipientOnce({
          req,
          incident,
          recipientRole: recipient.role,
          eventType,
          status,
          metadata,
        })
      )
    );
  } catch (err) {
    console.error("Notify Incident Event Error:", err);
  }
};

const buildIncidentHistoryMetadata = (req, incident, extra = {}) => ({
  incidentId: incident?._id || null,
  incidentType: normalizeString(incident?.type),
  incidentLevel: normalizeString(incident?.level),
  incidentStatus: normalizeString(incident?.status),
  actorName:
    normalizeString(req.session?.username) ||
    normalizeString(req.session?.name) ||
    "System",
  actorRole: normalizeRole(req.session?.role) || "system",
  ...extra,
});

// ✅ Get all incidents
const getIncidents = async (req, res) => {
  try {
    verifyPendingIncidentsBatch().catch((error) => {
      console.error("Incident fetch auto-verification trigger failed:", error);
    });

    const incidents = await IncidentModel.find().sort({ createdAt: -1 });
    res.json(incidents);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Register Incident (WITH IMAGE SUPPORT)
const registerIncident = async (req, res) => {
  const buffer = req.file?.buffer
    ? Buffer.isBuffer(req.file.buffer)
      ? req.file.buffer
      : Buffer.from(req.file.buffer)
    : null;

  if (req.file && buffer) {
    try {
      const parser = exif.create(buffer);
      parser.parse();
    } catch (err) {
      console.log("⚠️ Metadata extraction failed:", err.message);
    }
  }

  try {
    if (!req.body) req.body = {};

    let imageData = null;
    let verification = null;

    if (req.file && buffer) {
      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder: "evacuation_app/incidents" },
            (err, uploadedResult) => {
              if (err) return reject(err);
              resolve(uploadedResult);
            }
          )
          .end(req.file.buffer);
      });

      imageData = {
        fileName: req.file.originalname,
        fileUrl: result.secure_url,
        public_id: result.public_id,
      };

      if (imageData?.fileUrl) {
        verification = await verifyIncidentImage(buffer, req.body.type);
      }
    }

    const newIncident = new IncidentModel({
      type: req.body.type || "",
      level: req.body.level || "",
      location: req.body.location || "",
      description: req.body.description || "",
      latitude: req.body.latitude ? Number(req.body.latitude) : null,
      longitude: req.body.longitude ? Number(req.body.longitude) : null,

      // These only save if your Incident schema supports them.
      // They are still useful for notifications if present in req.body.
      barangayId: req.body.barangayId || req.session?.barangayId || null,
      barangayName:
        normalizeString(req.body.barangayName) ||
        normalizeString(req.body.barangay) ||
        normalizeString(req.session?.barangayName),

      image: imageData,

// ✅ Save who reported this incident.
// This is needed so the reporter can receive the approval notification later.
userId: req.body.userId || req.session?.userId || null,
reporterUserId:
  req.body.reporterUserId || req.body.userId || req.session?.userId || null,

usernames: req.body.usernames || req.session?.username || null,
phone: req.body.phone || null,
status: "reported",
expiresAt: new Date(Date.now() + INCIDENT_TTL_MS),
      verification: verification ? buildStoredVerification(verification) : undefined,
    });

    if (verification) {
      applyVerificationOutcome(newIncident, verification);
    }

    const incident = await newIncident.save();

    console.log("Incident registered:", incident);

    await HistoryModel.create({
      action: "ADD",
      placeName: incident.location,
      details: incident.description,
      metadata: buildIncidentHistoryMetadata(req, incident, {
        eventType: "created",
      }),
    });

    await notifyIncidentEvent({
      req,
      incident,
      eventType: "created",
    });

    if (normalizeString(incident.verification?.status).toLowerCase() === "approved") {
      await notifyReporterIncidentApprovedOnce({ req, incident });
    }

    return res.status(201).json({
      message: "Incident created successfully",
      incident,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Update status
const updateStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const updatedIncident = await IncidentModel.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updatedIncident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    await HistoryModel.create({
      action: "STATUS_UPDATE",
      placeName: updatedIncident.location,
      details: `Updated to ${status}`,
      metadata: buildIncidentHistoryMetadata(req, updatedIncident, {
        eventType: "status_update",
        status,
      }),
    });

    await notifyIncidentEvent({
      req,
      incident: updatedIncident,
      eventType: "status",
      status,
    });

    res.json(updatedIncident);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update status" });
  }
};

// ✅ Delete incident
const deleteIncident = async (req, res) => {
  try {
    const deleted = await IncidentModel.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Incident not found" });
    }

    await HistoryModel.create({
      action: "DELETE",
      placeName: deleted.location,
      details: deleted.description,
      metadata: buildIncidentHistoryMetadata(req, deleted, {
        eventType: "deleted",
      }),
    });

    await notifyIncidentEvent({
      req,
      incident: deleted,
      eventType: "deleted",
    });

    res.json({ message: "Incident deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete incident" });
  }
};

// ✅ Analytics (STATUS COUNTS)
const getIncidentStats = async (req, res) => {
  try {
    const stats = await IncidentModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    let result = {
      reported: 0,
      onProcess: 0,
      resolved: 0,
      total: 0,
    };

    stats.forEach((item) => {
      if (item._id === "reported" || item._id === "" || item._id === null) {
        result.reported += item.count;
      } else if (item._id === "onProcess") {
        result.onProcess = item.count;
      } else if (item._id === "resolved") {
        result.resolved = item.count;
      }
    });

    result.total = result.reported + result.onProcess + result.resolved;

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

// Get count of incidents per type
const getIncidentTypeStats = async (req, res) => {
  try {
    const stats = await IncidentModel.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {};
    stats.forEach((item) => {
      result[item._id || "Unknown"] = item.count;
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch type stats" });
  }
};

const getTrend = async (req, res) => {
  try {
    const data = await IncidentModel.aggregate([
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getIncidentHistory = async (req, res) => {
  try {
    const filter = safeLower(req.query.filter || "all");
    const search = safeLower(req.query.search || "");

    const [resolvedIncidents, deletedHistory] = await Promise.all([
      filter === "deleted"
        ? Promise.resolve([])
        : IncidentModel.find({ status: "resolved" }).sort({ updatedAt: -1 }).lean(),
      filter === "resolved"
        ? Promise.resolve([])
        : HistoryModel.find({ action: "DELETE" }).sort({ createdAt: -1 }).lean(),
    ]);

    let items = [
      ...resolvedIncidents.map((incident) => ({
        _id: `resolved-${incident._id}`,
        eventType: "resolved",
        incidentId: incident._id || null,
        type: normalizeString(incident.type) || "Incident",
        level: normalizeString(incident.level) || "-",
        location: normalizeString(incident.location) || "Unknown location",
        description: normalizeString(incident.description) || "No description provided.",
        status: "resolved",
        actorName:
          normalizeString(incident?.verification?.metadata?.reviewedBy) ||
          "DRRMO",
        actorRole: "drrmo",
        createdAt: incident.updatedAt || incident.createdAt || null,
        source: "incident",
      })),
      ...deletedHistory.map((entry) => ({
        _id: `deleted-${entry._id}`,
        eventType: "deleted",
        incidentId: entry?.metadata?.incidentId || null,
        type: normalizeString(entry?.metadata?.incidentType) || "Incident",
        level: normalizeString(entry?.metadata?.incidentLevel) || "-",
        location: normalizeString(entry.placeName) || "Unknown location",
        description: normalizeString(entry.details) || "Deleted incident record.",
        status: "deleted",
        actorName: normalizeString(entry?.metadata?.actorName) || "System",
        actorRole: normalizeRole(entry?.metadata?.actorRole) || "system",
        createdAt: entry.createdAt || null,
        source: "history",
      })),
    ];

    if (filter === "resolved") {
      items = items.filter((item) => item.eventType === "resolved");
    }

    if (filter === "deleted") {
      items = items.filter((item) => item.eventType === "deleted");
    }

    if (search) {
      items = items.filter((item) =>
        [
          item.type,
          item.level,
          item.location,
          item.description,
          item.status,
          item.actorName,
          item.actorRole,
        ]
          .map((value) => safeLower(value))
          .join(" ")
          .includes(search)
      );
    }

    items.sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    res.json({
      items,
      summary: {
        total: items.length,
        resolved: items.filter((item) => item.eventType === "resolved").length,
        deleted: items.filter((item) => item.eventType === "deleted").length,
      },
    });
  } catch (err) {
    console.error("Get incident history error:", err);
    res.status(500).json({ message: "Failed to load incident history." });
  }
};



const notifyReporterIncidentApprovedOnce = async ({ req, incident }) => {
  try {
    const reporterUserId =
      incident?.reporterUserId ||
      incident?.userId ||
      incident?.reportedBy ||
      null;

    if (!reporterUserId) {
      console.log("[reporter approval notification skipped no reporter]", {
        incidentId: String(incident?._id || ""),
        reporterUserId: incident?.reporterUserId || null,
        userId: incident?.userId || null,
      });
      return null;
    }

    const existing = await Notification.findOne({
      recipientUser: reporterUserId,
      module: "incident",
      type: "incident_approved",
      referenceId: incident._id,
    }).lean();

    if (existing) {
      console.log("[reporter approval notification skipped duplicate]", {
        incidentId: String(incident._id),
        reporterUserId: String(reporterUserId),
      });
      return existing;
    }

 const notification = await createNotification({
  recipientRole: "all",
  recipientUser: reporterUserId,
  recipientUserModel: null,

  senderUser: req.session?.userId || null,
  senderRole: normalizeRole(req.session?.role) || "drrmo",
  senderName:
    normalizeString(req.session?.username) ||
    normalizeString(req.session?.name) ||
    "MDRRMO",

  module: "incident",
  type: "incident_approved",
  priority: "normal",

  title: "Incident Report Verified",
  message:
    "Your reported incident has been reviewed and verified by the MDRRMO. It has been approved as a valid incident and is now visible on the public map for community awareness.",
  link: "/notifications",

  referenceId: incident._id,
  referenceModel: "Incident",

  metadata: {
    incidentId: incident._id,
    incidentType: incident.type || "",
    location: incident.location || "",
    approvalStatus: "approved",
  },
});

    if (!notification) {
  console.log("[reporter approval notification failed createNotification returned null]", {
    incidentId: String(incident._id),
    reporterUserId: String(reporterUserId),
  });
  return null;
}

console.log("[reporter approval notification created]", {
  notificationId: String(notification._id),
  incidentId: String(incident._id),
  reporterUserId: String(reporterUserId),
});

return notification;


  } catch (err) {
    console.error("Reporter Incident Approval Notification Error:", err);
    return null;
  }
};

const updateVerification = async (req, res) => {
  try {
    const { status } = req.body;

    const incident = await IncidentModel.findById(req.params.id);
    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    if (!["approved", "pending", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    if (!incident.verification) {
      incident.verification = {
        status: "pending",
        confidence: 0,
        labels: [],
        matchedLabels: [],
        isMatch: false,
        score: 0,
        reasoning: "Manual verification update",
        metadata: {
          hasGPS: false,
          isRecent: false,
          isWithinArea: false,
          device: null,
          width: null,
          height: null,
          timestamp: null,
        },
      };
    }

    incident.verification.status = status;

    if (status === "approved") {
      incident.set("isPublic", true);
      incident.set("approvedByMDRRMO", true);
      incident.set("forceApproved", true);
      incident.status = "approved";
    }

    if (status === "rejected") {
      incident.set("isPublic", false);
      incident.set("approvedByMDRRMO", false);
      incident.set("forceApproved", false);

      if (!incident.status || incident.status === "approved") {
        incident.status = "reported";
      }
    }

    await incident.save();

    console.log("[verification update]", {
      id: String(incident._id),
      verificationStatus: incident.verification?.status,
      status: incident.status,
      isPublic: incident.get("isPublic"),
      approvedByMDRRMO: incident.get("approvedByMDRRMO"),
      forceApproved: incident.get("forceApproved"),
    });

    await HistoryModel.create({
  action: "VERIFICATION_UPDATE",
  placeName: incident.location,
  details:
    status === "approved"
      ? "AI approved and incident approved for public mobile map."
      : `Verification set to ${status}`,
  metadata: buildIncidentHistoryMetadata(req, incident, {
    eventType: "verification_update",
    verificationStatus: status,
  }),
});

    await notifyIncidentEvent({
  req,
  incident,
  eventType: "verification",
  status,
});

// ✅ Notify the original reporter only when the incident is approved.
if (status === "approved") {
  await notifyReporterIncidentApprovedOnce({ req, incident });
}

res.json({
  message:
    status === "approved"
      ? "Incident approved and now visible on mobile map."
      : "Verification updated",
  incident,
});
  } catch (err) {
    console.error("UPDATE VERIFICATION ERROR:", err);

    res.status(500).json({
      error: "Failed to update verification",
      message: err.message,
    });
  }
};
const reverifyIncident = async (req, res) => {
  try {
    const incident = await IncidentModel.findById(req.params.id);

    if (!incident || !incident.image?.fileUrl) {
      return res.status(404).json({ message: "Incident or image not found" });
    }

    const verification = await verifyIncidentFromImageUrl(incident);

    console.log("=== AI VERIFICATION RESULT ===");
    console.log("Status:", verification?.status);
    console.log("Confidence:", verification?.confidence);
    console.log("Labels:", verification?.labels);
    console.log("Matched Labels:", verification?.matchedLabels);
    console.log("Is Match:", verification?.isMatch);
    console.log("---- METADATA ----");
    console.log("Raw Metadata:", verification?.metadata);
    console.log("Metadata Flags:", verification?.metadataFlags);
    console.log("GPS:", verification?.metadata?.gps);
    console.log("Device:", verification?.metadata?.device);
    console.log(
      "Dimensions:",
      verification?.metadata?.width,
      "x",
      verification?.metadata?.height
    );
    console.log("==============================");

    applyVerificationOutcome(incident, verification);

    await incident.save();

    try {
      await HistoryModel.create({
        action: "VERIFICATION_UPDATE",
        placeName: incident.location || "unknown",
        details: `Verification set to ${incident.verification.status}`,
        metadata: buildIncidentHistoryMetadata(req, incident, {
          eventType: "verification_update",
          verificationStatus: incident.verification.status,
        }),
      });
    } catch (e) {
      console.error("History save failed:", e.message);
    }

    await notifyIncidentEvent({
      req,
      incident,
      eventType: "reverified",
      status: incident.verification.status,
    });

    if (normalizeString(incident.verification?.status).toLowerCase() === "approved") {
      await notifyReporterIncidentApprovedOnce({ req, incident });
    }

    res.json({
      message: "Reverification complete",
      incident,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reverify incident" });
  }
};

/* EXPORT SINGLE INCIDENT PDF */
const exportIncidentPdf = async (req, res) => {
  try {
    const incident = await IncidentModel.findById(req.params.id).lean();

    if (!incident) {
      return res.status(404).json({ message: "Incident not found" });
    }

    const safeName = normalizeString(
      `${incident.type || "incident"}-${incident._id}`
    ).replace(/[^\w\-]+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}.pdf"`);

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(18).text("Incident Report", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).text(
      "Generated from Disaster Relief Management System",
      { align: "center" }
    );

    drawPdfSectionTitle(doc, "Incident Information");
    drawPdfLabelValue(doc, "Incident Type", formatLabel(incident.type));
    drawPdfLabelValue(doc, "Level", formatLabel(incident.level));
    drawPdfLabelValue(doc, "Location", normalizeString(incident.location) || "-");
    drawPdfLabelValue(doc, "Status", formatLabel(incident.status));
    drawPdfLabelValue(doc, "Latitude", incident.latitude ?? "-");
    drawPdfLabelValue(doc, "Longitude", incident.longitude ?? "-");
    drawPdfLabelValue(doc, "Reported At", formatDateValue(incident.createdAt));
    drawPdfLabelValue(doc, "Last Updated", formatDateValue(incident.updatedAt));
    drawPdfLabelValue(doc, "Expires At", formatDateValue(incident.expiresAt));

    drawPdfSectionTitle(doc, "Reporter Information");
    drawPdfLabelValue(doc, "Username", normalizeString(incident.usernames) || "-");
    drawPdfLabelValue(doc, "Phone", normalizeString(incident.phone) || "-");

    drawPdfSectionTitle(doc, "Description");
    doc.font("Helvetica").text(
      normalizeString(incident.description) || "No description provided."
    );

    drawPdfSectionTitle(doc, "Image Information");
    drawPdfLabelValue(
      doc,
      "Image File Name",
      normalizeString(incident.image?.fileName) || "No image uploaded"
    );
    drawPdfLabelValue(
      doc,
      "Image URL",
      normalizeString(incident.image?.fileUrl) || "No image uploaded"
    );

    drawPdfSectionTitle(doc, "Verification");
    drawPdfLabelValue(
      doc,
      "Verification Status",
      formatLabel(incident.verification?.status)
    );
    drawPdfLabelValue(
      doc,
      "Confidence",
      incident.verification?.confidence !== undefined &&
        incident.verification?.confidence !== null
        ? `${incident.verification.confidence}%`
        : "-"
    );
    drawPdfLabelValue(
      doc,
      "Is Match",
      incident.verification?.isMatch === undefined
        ? "-"
        : incident.verification.isMatch
          ? "Yes"
          : "No"
    );
    drawPdfLabelValue(doc, "Score", incident.verification?.score ?? "-");

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Reasoning:");
    doc.font("Helvetica").text(
      normalizeString(incident.verification?.reasoning) ||
        "No reasoning available."
    );

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Detected Labels:");
    doc.font("Helvetica").text(
      Array.isArray(incident.verification?.labels) &&
        incident.verification.labels.length
        ? incident.verification.labels.join(", ")
        : "None"
    );

    doc.moveDown(0.4);
    doc.font("Helvetica-Bold").text("Matched Labels:");
    doc.font("Helvetica").text(
      Array.isArray(incident.verification?.matchedLabels) &&
        incident.verification.matchedLabels.length
        ? incident.verification.matchedLabels.join(", ")
        : "None"
    );

    drawPdfSectionTitle(doc, "Verification Metadata");
    drawPdfLabelValue(
      doc,
      "Has GPS",
      incident.verification?.metadata?.hasGPS === undefined
        ? "-"
        : incident.verification.metadata.hasGPS
          ? "Yes"
          : "No"
    );
    drawPdfLabelValue(
      doc,
      "Is Recent",
      incident.verification?.metadata?.isRecent === undefined
        ? "-"
        : incident.verification.metadata.isRecent
          ? "Yes"
          : "No"
    );
    drawPdfLabelValue(
      doc,
      "Within Area",
      incident.verification?.metadata?.isWithinArea === undefined
        ? "-"
        : incident.verification.metadata.isWithinArea
          ? "Yes"
          : "No"
    );
    drawPdfLabelValue(
      doc,
      "Device",
      normalizeString(incident.verification?.metadata?.device) || "-"
    );
    drawPdfLabelValue(doc, "Width", incident.verification?.metadata?.width ?? "-");
    drawPdfLabelValue(doc, "Height", incident.verification?.metadata?.height ?? "-");
    drawPdfLabelValue(
      doc,
      "Timestamp",
      incident.verification?.metadata?.timestamp ?? "-"
    );

    ensurePdfPageSpace(doc, 60);
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(9).text(
      `Document generated on ${formatDateValue(new Date())}`,
      { align: "right" }
    );

    doc.end();
  } catch (err) {
    console.error("Export Incident PDF Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
};

module.exports = {
  getIncidents,
  getIncidentHistory,
  registerIncident,
  updateStatus,
  deleteIncident,
  getIncidentStats,
  getIncidentTypeStats,
  getTrend,
  updateVerification,
  reverifyIncident,
  exportIncidentPdf,
};

const Barangay = require("../models/Barangay");
const EvacPlace = require("../models/EvacPlace");
const ReliefRequest = require("../models/ReliefRequest");
const ReliefRelease = require("../models/ReliefRelease");
const Audit = require("../models/Audit");
const sendReliefRequestEmail = require("../utils/sendReliefRequestEmail");

const ACTIVE_REQUEST_STATUSES = ["pending", "approved", "partially_released", "released"];
const FINAL_REQUEST_STATUSES = ["received", "cancelled", "canceled", "rejected", "completed"];

const generateRequestNo = async () => {
  const year = new Date().getFullYear();
  const prefix = `RR-${year}`;

  const latest = await ReliefRequest.findOne({
    requestNo: { $regex: `^${prefix}-` },
  }).sort({ createdAt: -1 });

  let nextNumber = 1;

  if (latest?.requestNo) {
    const parts = latest.requestNo.split("-");
    const lastSeq = Number(parts[2]);
    if (!Number.isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeStatus = (value) => normalizeString(value).toLowerCase();

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const sanitizeRow = (row = {}) => ({
  evacPlaceId: row.evacPlaceId || null,
  evacuationCenterName: normalizeString(row.evacuationCenterName),
  households: toNumber(row.households),
  families: toNumber(row.families),
  male: toNumber(row.male),
  female: toNumber(row.female),
  lgbtq: toNumber(row.lgbtq),
  pwd: toNumber(row.pwd),
  pregnant: toNumber(row.pregnant),
  senior: toNumber(row.senior),
  requestedFoodPacks: toNumber(row.requestedFoodPacks),
  isActiveRow: row.isActiveRow !== undefined ? Boolean(row.isActiveRow) : true,
  rowRemarks: normalizeString(row.rowRemarks),
});

const buildRowsFromEvacPlaces = (places = []) =>
  places.map((place) => ({
    evacPlaceId: place._id,
    evacuationCenterName: normalizeString(place.name),
    households: 0,
    families: 0,
    male: 0,
    female: 0,
    lgbtq: 0,
    pwd: 0,
    pregnant: 0,
    senior: 0,
    requestedFoodPacks: 0,
    isActiveRow: true,
    rowRemarks: "",
  }));

const isNonNegativeNumber = (value) =>
  typeof value === "number" && !Number.isNaN(value) && value >= 0;

const validateRows = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "At least one evacuation center row is required.";
  }

  const seenNames = new Set();

  for (const row of rows) {
    if (!row.evacuationCenterName) {
      return "Each row must have an evacuation center name.";
    }

    const normalizedName = row.evacuationCenterName.toLowerCase();
    if (seenNames.has(normalizedName)) {
      return `Duplicate evacuation center row found for "${row.evacuationCenterName}".`;
    }
    seenNames.add(normalizedName);

    const numberFields = [
      "households",
      "families",
      "male",
      "female",
      "lgbtq",
      "pwd",
      "pregnant",
      "senior",
      "requestedFoodPacks",
    ];

    for (const field of numberFields) {
      if (!isNonNegativeNumber(row[field])) {
        return `Invalid value for ${field} in one of the rows.`;
      }
    }
  }

  return null;
};

const computePrioritySnapshotFromRows = (rows = []) => {
  const totalAffected = rows.reduce(
    (sum, row) =>
      sum +
      toNumber(row.male) +
      toNumber(row.female) +
      toNumber(row.lgbtq) +
      toNumber(row.pwd) +
      toNumber(row.pregnant) +
      toNumber(row.senior),
    0
  );

  const vulnerableCount = rows.reduce(
    (sum, row) =>
      sum + toNumber(row.pwd) + toNumber(row.pregnant) + toNumber(row.senior),
    0
  );

  const requestedFoodPacks = rows.reduce(
    (sum, row) => sum + toNumber(row.requestedFoodPacks),
    0
  );

  const priorityScore =
    vulnerableCount * 3 + totalAffected + requestedFoodPacks * 0.2;

  return {
    totalAffected,
    vulnerableCount,
    priorityScore,
  };
};

const buildFulfillmentFromReleases = (releases = []) => {
  const totalReleases = releases.length;

  const releasedFoodPacks = releases.reduce(
    (sum, release) => sum + toNumber(release.foodPacksReleased),
    0
  );

  const receivedFoodPacks = releases
    .filter((release) => release.releaseStatus === "received")
    .reduce((sum, release) => sum + toNumber(release.foodPacksReleased), 0);

  const receivedReleases = releases.filter(
    (release) => release.releaseStatus === "received"
  ).length;

  const pendingReleases = releases.filter(
    (release) => release.releaseStatus === "released"
  ).length;

  const lastRelease = releases
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  return {
    totalReleases,
    releasedFoodPacks,
    receivedFoodPacks,
    receivedReleases,
    pendingReleases,
    lastReleaseAt: lastRelease?.releasedAt || lastRelease?.createdAt || null,
  };
};

const deriveCurrentStage = (request, releases = []) => {
  if (!request) return "preparation";

  const status = normalizeStatus(request.status);

  if (status === "pending") return "pending_review";
  if (status === "rejected") return "rejected";
  if (status === "approved") return "approved_waiting_release";
  if (status === "partially_released") return "partially_released";
  if (status === "released") return "released_waiting_receipt";
  if (status === "received") return "completed";
  if (status === "cancelled" || status === "canceled") return "preparation";

  const hasReleased = releases.some(
    (release) => release.releaseStatus === "released"
  );
  const hasReceived = releases.some(
    (release) => release.releaseStatus === "received"
  );

  if (hasReleased && hasReceived) return "partially_released";
  if (hasReleased) return "released_waiting_receipt";
  if (hasReceived) return "completed";

  return "pending_review";
};

const buildEmptyJourneyResponse = () => ({
  request: null,
  releases: [],
  stage: "preparation",
  canEdit: false,
  canCancel: false,
  canReceiveAnyRelease: false,
  canRequestAgain: true,
  summary: null,
});

const refreshRequestProgress = async (requestId) => {
  const request = await ReliefRequest.findById(requestId);
  if (!request || request.isArchived) return null;

  const currentStatus = normalizeStatus(request.status);

  if (FINAL_REQUEST_STATUSES.includes(currentStatus)) {
    if (currentStatus === "cancelled" || currentStatus === "canceled") {
      request.currentStage = "preparation";
    } else if (currentStatus === "rejected") {
      request.currentStage = "rejected";
    } else {
      request.currentStage = "completed";
    }

    await request.save();
    return request;
  }

  const releases = await ReliefRelease.find({
    reliefRequestId: request._id,
    isArchived: false,
  }).sort({ createdAt: -1 });

  const fulfillment = buildFulfillmentFromReleases(releases);
  const requestedFoodPacks = toNumber(request?.totals?.requestedFoodPacks);
  const releasedFoodPacks = toNumber(fulfillment.releasedFoodPacks);
  const receivedFoodPacks = toNumber(fulfillment.receivedFoodPacks);
  const hasAnyRelease = releases.length > 0;

  request.fulfillment = {
    totalReleases: fulfillment.totalReleases,
    releasedFoodPacks: fulfillment.releasedFoodPacks,
    receivedReleases: fulfillment.receivedReleases,
    pendingReleases: fulfillment.pendingReleases,
    lastReleaseAt: fulfillment.lastReleaseAt,
  };

  request.prioritySnapshot = computePrioritySnapshotFromRows(request.rows || []);

  if (!hasAnyRelease) {
    if (!["pending", "rejected", "cancelled", "canceled", "received"].includes(normalizeStatus(request.status))) {
      request.status = "approved";
      request.currentStage = "approved_waiting_release";
    }
  } else if (requestedFoodPacks > 0) {
    if (receivedFoodPacks >= requestedFoodPacks) {
      request.status = "received";
      request.currentStage = "completed";
      if (!request.receivedAt) {
        request.receivedAt = new Date();
      }
    } else if (releasedFoodPacks >= requestedFoodPacks) {
      request.status = "released";
      request.currentStage = "released_waiting_receipt";
      request.receivedAt = null;
    } else {
      request.status = "partially_released";
      request.currentStage = "partially_released";
      request.receivedAt = null;
    }
  } else {
    request.currentStage = deriveCurrentStage(request, releases);
  }

  await request.save();
  return request;
};

/* BARANGAY REQUEST BOOTSTRAP */
const getReliefRequestBootstrap = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const barangay = await Barangay.findById(req.session.userId);
    if (!barangay) {
      return res.status(404).json({ message: "Barangay not found" });
    }

    const activeRequest = await ReliefRequest.findOne({
      barangayId: barangay._id,
      status: {
        $in: ACTIVE_REQUEST_STATUSES,
      },
      isArchived: false,
    }).sort({ createdAt: -1 });

    const evacPlaces = await EvacPlace.find({
  barangayId: barangay._id,
  isArchived: false,
  $or: [
    { isRequestVisible: true },
    { isRequestVisible: { $exists: false } },
    { isRequestVisible: null },
  ],
}).sort({ name: 1 });

    const rows = buildRowsFromEvacPlaces(evacPlaces);

    return res.json({
      hasActiveRequest: Boolean(activeRequest),
      activeRequest: activeRequest || null,
      barangay: {
        _id: barangay._id,
        barangayName: barangay.barangayName,
      },
      rows,
      meta: {
        totalEvacPlaces: evacPlaces.length,
        entryMode: "system_bootstrap",
        rowSource: "evac_place_snapshot",
      },
    });
  } catch (err) {
    console.error("Get Relief Request Bootstrap Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* BARANGAY SUBMIT RELIEF REQUEST */
const submitReliefRequest = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const barangay = await Barangay.findById(req.session.userId);
    if (!barangay) {
      return res.status(404).json({ message: "Barangay not found" });
    }

    const disaster = normalizeString(req.body.disaster);
    const remarks = normalizeString(req.body.remarks);
    const approvalRemarks = "";
    const releaseNotes = "";
    const requestDate = req.body.requestDate
      ? new Date(req.body.requestDate)
      : new Date();

    const entryMode = ["manual", "excel_import", "system_bootstrap"].includes(
      normalizeString(req.body.entryMode)
    )
      ? normalizeString(req.body.entryMode)
      : "system_bootstrap";

    const rowSource = ["evac_place_snapshot", "manual_override"].includes(
      normalizeString(req.body.rowSource)
    )
      ? normalizeString(req.body.rowSource)
      : "evac_place_snapshot";

    const rows = Array.isArray(req.body.rows)
      ? req.body.rows.map(sanitizeRow)
      : [];

    if (!disaster) {
      return res.status(400).json({ message: "Disaster is required." });
    }

    if (Number.isNaN(requestDate.getTime())) {
      return res.status(400).json({ message: "Invalid request date." });
    }

    const rowsError = validateRows(rows);
    if (rowsError) {
      return res.status(400).json({ message: rowsError });
    }

    const hasActiveRequest = await ReliefRequest.findOne({
      barangayId: barangay._id,
      status: {
        $in: ACTIVE_REQUEST_STATUSES,
      },
      isArchived: false,
    });

    if (hasActiveRequest) {
      return res.status(400).json({
        message: "You still have an active relief request.",
      });
    }

    const requestNo = await generateRequestNo();
    const prioritySnapshot = computePrioritySnapshotFromRows(rows);

    const reliefRequest = await ReliefRequest.create({
      requestNo,
      barangayId: barangay._id,
      barangayName: barangay.barangayName,
      disaster,
      requestDate,
      rows,
      remarks,
      approvalRemarks,
      releaseNotes,
      status: "pending",
      currentStage: "pending_review",
      entryMode,
      rowSource,
      fulfillment: {
        totalReleases: 0,
        releasedFoodPacks: 0,
        receivedReleases: 0,
        pendingReleases: 0,
        lastReleaseAt: null,
      },
      prioritySnapshot,
      emailSent: false,
      isArchived: false,
    });

    await Audit.create({
      barangayId: barangay._id,
      barangayName: barangay.barangayName,
      category: "relief_request",
      peopleRange: `Food packs requested: ${reliefRequest.totals.requestedFoodPacks}`,
      status: "requested",
      actionBy: "barangay",
    });

    let emailSent = false;

    try {
      await sendReliefRequestEmail(reliefRequest);
      emailSent = true;
    } catch (emailErr) {
      console.error("Relief request email failed:", emailErr);
    }

    reliefRequest.emailSent = emailSent;
    await reliefRequest.save();

    const latestRequest = await ReliefRequest.findById(reliefRequest._id);

    res.status(201).json({
      message: emailSent
        ? "Relief request submitted successfully."
        : "Relief request submitted successfully, but email notification failed.",
      request: latestRequest || reliefRequest,
    });
  } catch (err) {
    console.error("Submit Relief Request Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* GET LOGGED-IN BARANGAY RELIEF REQUESTS */
const getMyReliefRequests = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const requests = await ReliefRequest.find({
      barangayId: req.session.userId,
      isArchived: false,
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("Get My Relief Requests Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* GET SINGLE BARANGAY RELIEF REQUEST */
const getMyReliefRequestById = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    res.json(request);
  } catch (err) {
    console.error("Get My Relief Request By Id Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* GET CURRENT BARANGAY REQUEST JOURNEY */
const getCurrentReliefJourney = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const activeRequest = await ReliefRequest.findOne({
      barangayId: req.session.userId,
      isArchived: false,
      status: { $in: ACTIVE_REQUEST_STATUSES },
    }).sort({ createdAt: -1 });

    if (!activeRequest) {
      return res.json(buildEmptyJourneyResponse());
    }

    const updatedRequest = await refreshRequestProgress(activeRequest._id);
    const requestDoc = updatedRequest || activeRequest;
    const requestStatus = normalizeStatus(requestDoc.status);

    if (!ACTIVE_REQUEST_STATUSES.includes(requestStatus)) {
      return res.json(buildEmptyJourneyResponse());
    }

    const releases = await ReliefRelease.find({
      reliefRequestId: requestDoc._id,
      isArchived: false,
    }).sort({ createdAt: -1 });

    const fulfillment = buildFulfillmentFromReleases(releases);
    const stage = deriveCurrentStage(requestDoc, releases);
    const requestedFoodPacks = requestDoc.totals?.requestedFoodPacks || 0;
    const releasedFoodPacks = fulfillment.releasedFoodPacks || 0;
    const receivedFoodPacks = fulfillment.receivedFoodPacks || 0;

    const canEdit = requestStatus === "pending";
    const canCancel = ["pending", "approved"].includes(requestStatus);
    const canReceiveAnyRelease = releases.some(
      (release) => release.releaseStatus === "released"
    );
    const canRequestAgain = false;

    return res.json({
      request: requestDoc,
      releases,
      stage,
      canEdit,
      canCancel,
      canReceiveAnyRelease,
      canRequestAgain,
      summary: {
        requestedFoodPacks,
        releasedFoodPacks,
        receivedFoodPacks,
        remainingFoodPacks: Math.max(0, requestedFoodPacks - receivedFoodPacks),
        totalReleases: fulfillment.totalReleases || 0,
        receivedReleases: fulfillment.receivedReleases || 0,
        pendingReleases: fulfillment.pendingReleases || 0,
        vulnerableCount: requestDoc.prioritySnapshot?.vulnerableCount || 0,
        totalAffected: requestDoc.prioritySnapshot?.totalAffected || 0,
        requestDate: requestDoc.requestDate || null,
        receivedAt: requestDoc.receivedAt || null,
      },
    });
  } catch (err) {
    console.error("Get Current Relief Journey Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* BARANGAY UPDATE OWN REQUEST */
const updateOwnReliefRequest = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "Only pending requests can be edited.",
      });
    }

    const disaster = normalizeString(req.body.disaster);
    const remarks = normalizeString(req.body.remarks);
    const requestDate = req.body.requestDate
      ? new Date(req.body.requestDate)
      : request.requestDate;

    const entryMode = ["manual", "excel_import", "system_bootstrap"].includes(
      normalizeString(req.body.entryMode)
    )
      ? normalizeString(req.body.entryMode)
      : request.entryMode || "system_bootstrap";

    const rowSource = ["evac_place_snapshot", "manual_override"].includes(
      normalizeString(req.body.rowSource)
    )
      ? normalizeString(req.body.rowSource)
      : request.rowSource || "evac_place_snapshot";

    const rows = Array.isArray(req.body.rows)
      ? req.body.rows.map(sanitizeRow)
      : [];

    if (!disaster) {
      return res.status(400).json({ message: "Disaster is required." });
    }

    if (Number.isNaN(requestDate.getTime())) {
      return res.status(400).json({ message: "Invalid request date." });
    }

    const rowsError = validateRows(rows);
    if (rowsError) {
      return res.status(400).json({ message: rowsError });
    }

    request.disaster = disaster;
    request.requestDate = requestDate;
    request.rows = rows;
    request.remarks = remarks;
    request.entryMode = entryMode;
    request.rowSource = rowSource;
    request.prioritySnapshot = computePrioritySnapshotFromRows(rows);
    request.currentStage = "pending_review";

    await request.save();

    await Audit.create({
      barangayId: request.barangayId,
      barangayName: request.barangayName,
      category: "relief_request",
      peopleRange: `Updated food packs requested: ${request.totals.requestedFoodPacks}`,
      status: "updated",
      actionBy: "barangay",
    });

    res.json({
      message: "Relief request updated successfully.",
      request,
    });
  } catch (err) {
    console.error("Update Own Relief Request Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* BARANGAY CANCEL OWN REQUEST */
const cancelOwnReliefRequest = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    if (!["pending", "approved"].includes(normalizeStatus(request.status))) {
      return res.status(400).json({
        message: "Only pending or approved requests can be cancelled.",
      });
    }

    request.status = "cancelled";
    request.currentStage = "preparation";
    request.receivedAt = null;
    request.remarks = req.body.remarks
      ? normalizeString(req.body.remarks)
      : request.remarks;

    await request.save();

    await Audit.create({
      barangayId: request.barangayId,
      barangayName: request.barangayName,
      category: "relief_request",
      peopleRange: `Food packs requested: ${request.totals.requestedFoodPacks}`,
      status: "cancelled",
      actionBy: "barangay",
    });

    return res.json({
      message: "Relief request cancelled successfully.",
      request,
      journey: buildEmptyJourneyResponse(),
    });
  } catch (err) {
    console.error("Cancel Own Relief Request Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* BARANGAY MARK RECEIVED RELEASES FOR A REQUEST */
const markReliefRequestReceived = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const username = String(req.session?.username || req.session?.userId || "");

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    });

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    if (!["released", "partially_released"].includes(normalizeStatus(request.status))) {
      return res.status(400).json({
        message: "Only released requests can be marked as received.",
      });
    }

    const releasesToReceive = await ReliefRelease.find({
      reliefRequestId: request._id,
      isArchived: false,
      releaseStatus: "released",
    });

    if (!releasesToReceive.length) {
      return res.status(400).json({
        message: "No released deliveries found for this request.",
      });
    }

    const now = new Date();

    for (const release of releasesToReceive) {
      release.releaseStatus = "received";
      release.receivedAt = now;
      release.receivedBy = username;
      await release.save();
    }

    const updatedRequest = await refreshRequestProgress(request._id);

    await Audit.create({
      barangayId: request.barangayId,
      barangayName: request.barangayName,
      category: "relief_request",
      peopleRange:
        toNumber(updatedRequest?.fulfillment?.releasedFoodPacks) > 0
          ? `Received ${toNumber(updatedRequest.fulfillment.releasedFoodPacks)} released food packs so far`
          : `Received released deliveries for request ${request.requestNo}`,
      status: updatedRequest?.status || "partially_released",
      actionBy: "barangay",
    });

    const requestedFoodPacks = toNumber(updatedRequest?.totals?.requestedFoodPacks);
    const receivedFoodPacks = toNumber(
      buildFulfillmentFromReleases(
        await ReliefRelease.find({
          reliefRequestId: request._id,
          isArchived: false,
        })
      ).receivedFoodPacks
    );

    const remainingFoodPacks = Math.max(0, requestedFoodPacks - receivedFoodPacks);

    res.json({
      message:
        remainingFoodPacks > 0
          ? `Relief received. ${remainingFoodPacks} food pack(s) still remaining to fulfill this request.`
          : "Relief request marked as received successfully.",
      request: updatedRequest,
    });
  } catch (err) {
    console.error("Mark Relief Request Received Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getReliefRequestBootstrap,
  submitReliefRequest,
  getMyReliefRequests,
  getMyReliefRequestById,
  getCurrentReliefJourney,
  updateOwnReliefRequest,
  cancelOwnReliefRequest,
  markReliefRequestReceived,
  refreshRequestProgress,
};
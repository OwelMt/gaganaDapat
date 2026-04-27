const PDFDocument = require("pdfkit");
const Barangay = require("../models/Barangay");
const EvacPlace = require("../models/EvacPlace");
const ReliefRequest = require("../models/ReliefRequest");
const ReliefRelease = require("../models/ReliefRelease");
const Audit = require("../models/Audit");
const sendReliefRequestEmail = require("../utils/sendReliefRequestEmail");
const createNotification = require("../utils/createNotification");

const ACTIVE_REQUEST_STATUSES = ["pending", "approved", "partially_released", "released"];
const VIEWABLE_REQUEST_STATUSES = [
  "pending",
  "approved",
  "partially_released",
  "released",
  "received",
  "completed",
  "rejected",
  "cancelled",
  "canceled",
];
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
  if (status === "received" || status === "completed") return "completed";
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

const getDecisionRemarks = (request) => {
  return (
    normalizeString(request?.rejectionReason) ||
    normalizeString(request?.rejectionRemarks) ||
    normalizeString(request?.decisionRemarks) ||
    normalizeString(request?.approvalRemarks) ||
    normalizeString(request?.reviewRemarks) ||
    ""
  );
};

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

const formatStatusLabel = (status) => {
  const normalized = normalizeStatus(status);
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

const drawSimpleTableHeader = (doc, columns) => {
  ensurePdfPageSpace(doc, 30);
  const startX = doc.page.margins.left;
  const startY = doc.y;

  doc.font("Helvetica-Bold").fontSize(8);
  let x = startX;

  columns.forEach((col) => {
    doc.text(col.label, x, startY, {
      width: col.width,
      align: col.align || "left",
    });
    x += col.width;
  });

  doc.moveTo(startX, startY + 14)
    .lineTo(doc.page.width - doc.page.margins.right, startY + 14)
    .stroke();

  doc.y = startY + 18;
  doc.font("Helvetica").fontSize(8);
};

const drawSimpleTableRow = (doc, columns, row, rowHeight = 24) => {
  ensurePdfPageSpace(doc, rowHeight + 12);

  const startX = doc.page.margins.left;
  const startY = doc.y;
  let x = startX;

  columns.forEach((col) => {
    const value = row[col.key] ?? "-";
    doc.text(String(value), x, startY, {
      width: col.width,
      align: col.align || "left",
    });
    x += col.width;
  });

  doc.moveTo(startX, startY + rowHeight - 4)
    .lineTo(doc.page.width - doc.page.margins.right, startY + rowHeight - 4)
    .strokeColor("#dddddd")
    .stroke()
    .strokeColor("#000000");

  doc.y = startY + rowHeight;
};

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
    if (
      !["pending", "rejected", "cancelled", "canceled", "received", "completed"].includes(
        normalizeStatus(request.status)
      )
    ) {
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

    const buildLooseBarangayRegex = (value) => {
      const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

      if (!normalized) return null;

      const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(escaped.split("").join("[\\s_-]*"), "i");
    };

    const barangayName = normalizeString(
      barangay.barangayName || req.session?.barangayName || req.session?.username
    );

    const looseBarangayRegex = buildLooseBarangayRegex(barangayName);

    const ownershipOr = [{ barangayId: barangay._id }];

    if (barangayName) {
      ownershipOr.push({ barangayName });
    }

    if (looseBarangayRegex) {
      ownershipOr.push({ barangayName: looseBarangayRegex });
    }

    const evacPlaces = await EvacPlace.find({
      isArchived: false,
      $and: [
        { $or: ownershipOr },
        {
          $or: [
            { isRequestVisible: true },
            { isRequestVisible: { $exists: false } },
            { isRequestVisible: null },
          ],
        },
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
      isEditedAfterSubmit: false,
      lastEditedAt: null,
      editCount: 0,
      lastEditedBy: "",
    });

    await Audit.create({
      barangayId: barangay._id,
      barangayName: barangay.barangayName,
      category: "relief_request",
      peopleRange: `Food packs requested: ${reliefRequest.totals.requestedFoodPacks}`,
      status: "requested",
      actionBy: "barangay",
    });

    await createNotification({
  recipientRole: "drrmo",
  senderUser: barangay._id,
  senderRole: "barangay",
  senderName: barangay.barangayName || barangay.username,

  module: "relief",
  type: "relief_request_submitted",
  priority: "high",

  title: "New relief request submitted",
  message: `${barangay.barangayName} submitted relief request ${reliefRequest.requestNo} for ${reliefRequest.disaster}.`,
  link: "/drrmo/relief-lists",

  referenceId: reliefRequest._id,
  referenceModel: "ReliefRequest",
  metadata: {
    requestNo: reliefRequest.requestNo,
    barangayName: barangay.barangayName,
    disaster: reliefRequest.disaster,
    requestedFoodPacks: reliefRequest.totals?.requestedFoodPacks || 0,
    totalAffected: reliefRequest.prioritySnapshot?.totalAffected || 0,
    vulnerableCount: reliefRequest.prioritySnapshot?.vulnerableCount || 0,
  },
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

/* EXPORT SINGLE BARANGAY RELIEF REQUEST PDF */
const exportMyReliefRequestPdf = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const request = await ReliefRequest.findOne({
      _id: req.params.id,
      barangayId: req.session.userId,
      isArchived: false,
    }).lean();

    if (!request) {
      return res.status(404).json({ message: "Relief request not found" });
    }

    const decisionRemarks = getDecisionRemarks(request);
    const totals = request.totals || {};
    const rows = Array.isArray(request.rows) ? request.rows : [];

    const safeRequestNo = normalizeString(request.requestNo || "relief-request")
      .replace(/[^\w\-]+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${safeRequestNo}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(18).text("Relief Request", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).text("Generated from Disaster Relief Management System", {
      align: "center",
    });

    doc.moveDown(1);

    drawPdfSectionTitle(doc, "Request Information");
    drawPdfLabelValue(doc, "Request No", request.requestNo || "-");
    drawPdfLabelValue(doc, "Barangay", request.barangayName || "-");
    drawPdfLabelValue(doc, "Disaster", request.disaster || "-");
    drawPdfLabelValue(doc, "Request Date", formatDateValue(request.requestDate));
    drawPdfLabelValue(doc, "Status", formatStatusLabel(request.status));
    drawPdfLabelValue(doc, "Current Stage", formatStatusLabel(request.currentStage));
    drawPdfLabelValue(doc, "Submitted At", formatDateValue(request.createdAt));
    drawPdfLabelValue(doc, "Last Updated", formatDateValue(request.updatedAt));

    if (request.approvedAt) {
      drawPdfLabelValue(doc, "Approved At", formatDateValue(request.approvedAt));
    }

    if (request.rejectedAt) {
      drawPdfLabelValue(doc, "Rejected At", formatDateValue(request.rejectedAt));
    }

    if (request.receivedAt) {
      drawPdfLabelValue(doc, "Received At", formatDateValue(request.receivedAt));
    }

    drawPdfSectionTitle(doc, "Remarks");
    doc.font("Helvetica-Bold").text("Barangay Remarks:");
    doc.font("Helvetica").text(normalizeString(request.remarks) || "None");
    doc.moveDown(0.5);

    doc.font("Helvetica-Bold").text("Decision / Rejection Remarks:");
    doc.font("Helvetica").text(decisionRemarks || "None");

    drawPdfSectionTitle(doc, "Request Totals");
    drawPdfLabelValue(doc, "Households", String(toNumber(totals.households)));
    drawPdfLabelValue(doc, "Families", String(toNumber(totals.families)));
    drawPdfLabelValue(doc, "Male", String(toNumber(totals.male)));
    drawPdfLabelValue(doc, "Female", String(toNumber(totals.female)));
    drawPdfLabelValue(doc, "LGBTQ+", String(toNumber(totals.lgbtq)));
    drawPdfLabelValue(doc, "PWD", String(toNumber(totals.pwd)));
    drawPdfLabelValue(doc, "Pregnant", String(toNumber(totals.pregnant)));
    drawPdfLabelValue(doc, "Senior", String(toNumber(totals.senior)));
    drawPdfLabelValue(doc, "Requested Food Packs", String(toNumber(totals.requestedFoodPacks)));

    drawPdfSectionTitle(doc, "Evacuation Center Breakdown");

    const columns = [
      { label: "Evacuation Center", key: "evacuationCenterName", width: 120 },
      { label: "HH", key: "households", width: 28, align: "right" },
      { label: "Fam", key: "families", width: 32, align: "right" },
      { label: "M", key: "male", width: 24, align: "right" },
      { label: "F", key: "female", width: 24, align: "right" },
      { label: "LGBTQ", key: "lgbtq", width: 38, align: "right" },
      { label: "PWD", key: "pwd", width: 30, align: "right" },
      { label: "Preg", key: "pregnant", width: 34, align: "right" },
      { label: "Senior", key: "senior", width: 34, align: "right" },
      { label: "Packs", key: "requestedFoodPacks", width: 40, align: "right" },
    ];

    if (!rows.length) {
      doc.font("Helvetica").fontSize(10).text("No evacuation center rows available.");
    } else {
      drawSimpleTableHeader(doc, columns);

      rows.forEach((row) => {
        drawSimpleTableRow(doc, columns, {
          evacuationCenterName: normalizeString(row.evacuationCenterName) || "-",
          households: toNumber(row.households),
          families: toNumber(row.families),
          male: toNumber(row.male),
          female: toNumber(row.female),
          lgbtq: toNumber(row.lgbtq),
          pwd: toNumber(row.pwd),
          pregnant: toNumber(row.pregnant),
          senior: toNumber(row.senior),
          requestedFoodPacks: toNumber(row.requestedFoodPacks),
        });
      });
    }

    const rowsWithRemarks = rows.filter((row) => normalizeString(row.rowRemarks));

    if (rowsWithRemarks.length) {
      drawPdfSectionTitle(doc, "Row Remarks");

      rowsWithRemarks.forEach((row, index) => {
        ensurePdfPageSpace(doc, 50);
        doc.font("Helvetica-Bold").fontSize(10).text(
          `${index + 1}. ${normalizeString(row.evacuationCenterName) || "Unnamed Evacuation Center"}`
        );
        doc.font("Helvetica").fontSize(10).text(normalizeString(row.rowRemarks));
        doc.moveDown(0.4);
      });
    }

    drawPdfSectionTitle(doc, "Request Progress Snapshot");
    drawPdfLabelValue(
      doc,
      "Total Releases",
      String(toNumber(request.fulfillment?.totalReleases))
    );
    drawPdfLabelValue(
      doc,
      "Released Food Packs",
      String(toNumber(request.fulfillment?.releasedFoodPacks))
    );
    drawPdfLabelValue(
      doc,
      "Received Releases",
      String(toNumber(request.fulfillment?.receivedReleases))
    );
    drawPdfLabelValue(
      doc,
      "Pending Releases",
      String(toNumber(request.fulfillment?.pendingReleases))
    );
    drawPdfLabelValue(
      doc,
      "Last Release At",
      formatDateValue(request.fulfillment?.lastReleaseAt)
    );

    ensurePdfPageSpace(doc, 80);
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(9).text(
      `Document generated on ${formatDateValue(new Date())}`,
      { align: "right" }
    );

    doc.end();
  } catch (err) {
    console.error("Export My Relief Request PDF Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
};

/* GET CURRENT BARANGAY REQUEST JOURNEY */
const getCurrentReliefJourney = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const latestRequest = await ReliefRequest.findOne({
      barangayId: req.session.userId,
      isArchived: false,
      status: { $in: VIEWABLE_REQUEST_STATUSES },
    }).sort({ createdAt: -1 });

    if (!latestRequest) {
      return res.json(buildEmptyJourneyResponse());
    }

    const refreshedRequest = await refreshRequestProgress(latestRequest._id);
    const requestDoc = refreshedRequest || latestRequest;
    const requestStatus = normalizeStatus(requestDoc.status);

    const releases = await ReliefRelease.find({
      reliefRequestId: requestDoc._id,
      isArchived: false,
    }).sort({ createdAt: -1 });

    const fulfillment = buildFulfillmentFromReleases(releases);
    const stage = deriveCurrentStage(requestDoc, releases);
    const requestedFoodPacks = requestDoc.totals?.requestedFoodPacks || 0;
    const releasedFoodPacks = fulfillment.releasedFoodPacks || 0;
    const receivedFoodPacks = fulfillment.receivedFoodPacks || 0;
    const decisionRemarks = getDecisionRemarks(requestDoc);

    const canEdit = requestStatus === "pending";
    const canCancel = ["pending", "approved"].includes(requestStatus);
    const canReceiveAnyRelease = releases.some(
      (release) => release.releaseStatus === "released"
    );
    const canRequestAgain = FINAL_REQUEST_STATUSES.includes(requestStatus);

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
        decisionRemarks,
        rejectionRemarks: decisionRemarks,
        isRejected: requestStatus === "rejected",
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

    const currentStatus = normalizeStatus(request.status);
    const isRejectedResubmission =
      currentStatus === "rejected" && Boolean(req.body.resubmitRejected);

    if (!["pending", "rejected"].includes(currentStatus)) {
      return res.status(400).json({
        message: "Only pending or rejected requests can be edited.",
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
    request.isEditedAfterSubmit = true;
    request.lastEditedAt = new Date();
    request.editCount = Number(request.editCount || 0) + 1;
    request.lastEditedBy = "barangay";

    if (isRejectedResubmission) {
      request.status = "pending";
      request.currentStage = "pending_review";
      request.rejectionReason = "";
      request.rejectionRemarks = "";
      request.decisionRemarks = "";
      request.reviewRemarks = "";
      request.rejectedAt = null;
      request.reviewedAt = null;
      request.reviewedBy = "";
      request.approvedAt = null;
      request.approvedBy = "";
    } else {
      request.currentStage = "pending_review";
    }

    await request.save();

    await Audit.create({
      barangayId: request.barangayId,
      barangayName: request.barangayName,
      category: "relief_request",
      peopleRange: `Updated food packs requested: ${request.totals.requestedFoodPacks}`,
      status: isRejectedResubmission ? "resubmitted" : "updated",
      actionBy: "barangay",
    });

    await createNotification({
  recipientRole: "drrmo",
  senderUser: request.barangayId,
  senderRole: "barangay",
  senderName: request.barangayName,

  module: "relief",
  type: isRejectedResubmission
    ? "relief_request_resubmitted"
    : "relief_request_updated",
  priority: isRejectedResubmission ? "high" : "normal",

  title: isRejectedResubmission
    ? "Relief request resubmitted"
    : "Relief request updated",
  message: `${request.barangayName} ${
    isRejectedResubmission ? "resubmitted" : "updated"
  } relief request ${request.requestNo}.`,
  link: "/drrmo/relief-lists",

  referenceId: request._id,
  referenceModel: "ReliefRequest",
  metadata: {
    requestNo: request.requestNo,
    barangayName: request.barangayName,
    disaster: request.disaster,
    requestedFoodPacks: request.totals?.requestedFoodPacks || 0,
    editCount: request.editCount || 0,
  },
});

    res.json({
      message: isRejectedResubmission
        ? "Relief request resubmitted successfully."
        : "Relief request updated successfully.",
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

    await createNotification({
  recipientRole: "drrmo",
  senderUser: request.barangayId,
  senderRole: "barangay",
  senderName: request.barangayName,

  module: "relief",
  type: "relief_request_cancelled",
  priority: "normal",

  title: "Relief request cancelled",
  message: `${request.barangayName} cancelled relief request ${request.requestNo}.`,
  link: "/drrmo/relief-lists",

  referenceId: request._id,
  referenceModel: "ReliefRequest",
  metadata: {
    requestNo: request.requestNo,
    barangayName: request.barangayName,
    disaster: request.disaster,
    requestedFoodPacks: request.totals?.requestedFoodPacks || 0,
  },
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

    await createNotification({
  recipientRole: "drrmo",
  senderUser: request.barangayId,
  senderRole: "barangay",
  senderName: request.barangayName,

  module: "relief",
  type: "relief_request_received",
  priority: "normal",

  title: "Relief delivery received",
  message: `${request.barangayName} marked relief request ${request.requestNo} as received.`,
  link: "/drrmo/relief-lists",

  referenceId: request._id,
  referenceModel: "ReliefRequest",
  metadata: {
    requestNo: request.requestNo,
    barangayName: request.barangayName,
    disaster: request.disaster,
    status: updatedRequest?.status || request.status,
    releasedFoodPacks: updatedRequest?.fulfillment?.releasedFoodPacks || 0,
  },
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
  exportMyReliefRequestPdf,
  getCurrentReliefJourney,
  updateOwnReliefRequest,
  cancelOwnReliefRequest,
  markReliefRequestReceived,
  refreshRequestProgress,
};
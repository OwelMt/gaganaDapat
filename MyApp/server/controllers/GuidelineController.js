const PDFDocument = require("pdfkit");
const PostingGuideline = require("../models/Guidelines");
const Notification = require("../models/Notification");
const createNotification = require("../utils/createNotification");
const cloudinary = require("../config/cloudinary");

const PRIORITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const sortGuidelines = (items = []) => {
  return [...items].sort((a, b) => {
    const priorityDiff =
      (PRIORITY_RANK[b.priorityLevel] || 0) - (PRIORITY_RANK[a.priorityLevel] || 0);

    if (priorityDiff !== 0) return priorityDiff;

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeLower = (value) => {
  return normalizeString(value).toLowerCase();
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

const uploadFilesToCloudinary = async (files = []) => {
  return Promise.all(
    files.map((file) => {
      return new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            { folder: "evacuation_app/guidelines" },
            (err, result) => {
              if (err) return reject(err);

              resolve({
                fileName: file.originalname,
                fileUrl: result.secure_url,
                public_id: result.public_id,
              });
            }
          )
          .end(file.buffer);
      });
    })
  );
};

// -----------------------------
// NOTIFICATION HELPERS
// DRRMO ONLY
// -----------------------------
const getNotificationDayKey = () => {
  return new Date().toISOString().slice(0, 10);
};

const getGuidelinePriority = (guideline) => {
  return normalizeLower(guideline?.priorityLevel || "medium");
};

const getGuidelineStatus = (guideline) => {
  return normalizeLower(guideline?.status || "draft");
};

const getNotificationPriorityFromGuideline = (guideline, fallback = "normal") => {
  const priority = getGuidelinePriority(guideline);

  if (priority === "critical") return "critical";
  if (priority === "high") return "high";

  return fallback;
};

const getActorName = (req) => {
  return (
    normalizeString(req.session?.username) ||
    normalizeString(req.session?.name) ||
    "System"
  );
};

const createGuidelineNotificationOnce = async ({
  req,
  guideline,
  type,
  priority = "normal",
  title,
  message,
  metadata = {},
}) => {
  try {
    if (!guideline?._id || !type || !title || !message) return null;

    const dayKey = getNotificationDayKey();

    const existing = await Notification.findOne({
      recipientRole: "drrmo",
      module: "guidelines",
      type,
      referenceId: guideline._id,
      "metadata.dayKey": dayKey,
    }).lean();

    if (existing) return existing;

    return await createNotification({
      recipientRole: "drrmo",

      senderUser: req.session?.userId || null,
      senderRole: req.session?.role || "",
      senderName: getActorName(req),

      module: "guidelines",
      type,
      priority,

      title,
      message,
      link: "/drrmo/guidelines",

      referenceId: guideline._id,
      referenceModel: "PostingGuideline",

      metadata: {
        dayKey,
        guidelineId: guideline._id,
        title: guideline.title || "",
        category: guideline.category || "",
        status: guideline.status || "",
        priorityLevel: guideline.priorityLevel || "",
        views: Number(guideline.views || 0),
        attachmentCount: Array.isArray(guideline.attachments)
          ? guideline.attachments.length
          : 0,
        ...metadata,
      },
    });
  } catch (err) {
    console.error("Create Guideline Notification Once Error:", err);
    return null;
  }
};

const notifyGuidelineCreated = async (req, guideline) => {
  try {
    const status = getGuidelineStatus(guideline);
    const priorityLevel = getGuidelinePriority(guideline);

    if (status === "published") {
      await createGuidelineNotificationOnce({
        req,
        guideline,
        type: "guideline_published",
        priority: getNotificationPriorityFromGuideline(guideline, "normal"),
        title: "Guideline published",
        message: `${guideline.title} was published under ${formatLabel(
          guideline.category
        )} guidelines.`,
        metadata: {
          alertReason: "published_on_create",
        },
      });

      return;
    }

    if (priorityLevel === "critical" || priorityLevel === "high") {
      await createGuidelineNotificationOnce({
        req,
        guideline,
        type: "guideline_priority_draft_created",
        priority: getNotificationPriorityFromGuideline(guideline, "high"),
        title: "High-priority guideline draft created",
        message: `${guideline.title} was created as a ${formatLabel(
          guideline.priorityLevel
        )} priority draft.`,
        metadata: {
          alertReason: "priority_draft_created",
        },
      });

      return;
    }

    await createGuidelineNotificationOnce({
      req,
      guideline,
      type: "guideline_draft_created",
      priority: "low",
      title: "Guideline draft created",
      message: `${guideline.title} was saved as a draft.`,
      metadata: {
        alertReason: "draft_created",
      },
    });
  } catch (err) {
    console.error("Notify Guideline Created Error:", err);
  }
};

const notifyGuidelineUpdated = async ({
  req,
  guideline,
  previousStatus = "",
  previousPriority = "",
}) => {
  try {
    const currentStatus = getGuidelineStatus(guideline);
    const currentPriority = getGuidelinePriority(guideline);

    if (previousStatus !== "published" && currentStatus === "published") {
      await createGuidelineNotificationOnce({
        req,
        guideline,
        type: "guideline_published",
        priority: getNotificationPriorityFromGuideline(guideline, "normal"),
        title: "Guideline published",
        message: `${guideline.title} was published under ${formatLabel(
          guideline.category
        )} guidelines.`,
        metadata: {
          alertReason: "status_changed_to_published",
          previousStatus,
        },
      });

      return;
    }

    if (previousStatus !== currentStatus) {
      await createGuidelineNotificationOnce({
        req,
        guideline,
        type: "guideline_status_updated",
        priority: currentStatus === "archived" ? "high" : "normal",
        title: "Guideline status updated",
        message: `${guideline.title} status changed from ${formatLabel(
          previousStatus
        )} to ${formatLabel(currentStatus)}.`,
        metadata: {
          alertReason: "status_updated",
          previousStatus,
        },
      });

      return;
    }

    if (previousPriority !== currentPriority && currentPriority === "critical") {
      await createGuidelineNotificationOnce({
        req,
        guideline,
        type: "guideline_critical_priority",
        priority: "critical",
        title: "Guideline marked critical",
        message: `${guideline.title} is now marked as Critical priority.`,
        metadata: {
          alertReason: "priority_changed_to_critical",
          previousPriority,
        },
      });

      return;
    }

    if (previousPriority !== currentPriority && currentPriority === "high") {
      await createGuidelineNotificationOnce({
        req,
        guideline,
        type: "guideline_high_priority",
        priority: "high",
        title: "Guideline marked high priority",
        message: `${guideline.title} is now marked as High priority.`,
        metadata: {
          alertReason: "priority_changed_to_high",
          previousPriority,
        },
      });

      return;
    }

    if (currentStatus === "published") {
      await createGuidelineNotificationOnce({
        req,
        guideline,
        type: "guideline_published_updated",
        priority: getNotificationPriorityFromGuideline(guideline, "normal"),
        title: "Published guideline updated",
        message: `${guideline.title} was updated while published.`,
        metadata: {
          alertReason: "published_updated",
        },
      });
    }
  } catch (err) {
    console.error("Notify Guideline Updated Error:", err);
  }
};

const notifyGuidelineArchived = async (req, guideline) => {
  try {
    await createGuidelineNotificationOnce({
      req,
      guideline,
      type: "guideline_archived",
      priority: "high",
      title: "Guideline archived",
      message: `${guideline.title} was archived and is no longer published.`,
      metadata: {
        alertReason: "archived",
      },
    });
  } catch (err) {
    console.error("Notify Guideline Archived Error:", err);
  }
};

const notifyGuidelineRestored = async (req, guideline) => {
  try {
    await createGuidelineNotificationOnce({
      req,
      guideline,
      type: "guideline_restored",
      priority: "normal",
      title: "Guideline restored",
      message: `${guideline.title} was restored as a draft.`,
      metadata: {
        alertReason: "restored",
      },
    });
  } catch (err) {
    console.error("Notify Guideline Restored Error:", err);
  }
};

const notifyGuidelineDeleted = async (req, guideline) => {
  try {
    await createGuidelineNotificationOnce({
      req,
      guideline,
      type: "guideline_deleted",
      priority: "high",
      title: "Guideline deleted",
      message: `${guideline.title} was permanently deleted.`,
      metadata: {
        alertReason: "deleted",
      },
    });
  } catch (err) {
    console.error("Notify Guideline Deleted Error:", err);
  }
};

// CREATE
const createGuideline = async (req, res) => {
  try {
    const files = req.files || [];
    const attachments = await uploadFilesToCloudinary(files);

    const guideline = await PostingGuideline.create({
      title: req.body.title,
      description: req.body.description,
      category: req.body.category,
      status: req.body.status || "draft",
      priorityLevel: req.body.priorityLevel || "medium",
      attachments,
    });

    await notifyGuidelineCreated(req, guideline);

    return res.status(201).json(guideline);
  } catch (err) {
    console.error("Error creating guideline:", err);
    return res.status(400).json({ error: err.message });
  }
};

// LIST
const getGuidelines = async (req, res) => {
  try {
    const { status, category } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;

    const guidelines = await PostingGuideline.find(filter).lean();
    const sorted = sortGuidelines(guidelines);

    return res.status(200).json(sorted);
  } catch (err) {
    console.error("Error fetching guidelines:", err);
    return res.status(500).json({ error: err.message });
  }
};

// PUBLISHED ONLY
const getPublishedGuidelines = async (req, res) => {
  try {
    const guidelines = await PostingGuideline.find({ status: "published" }).lean();
    const sorted = sortGuidelines(guidelines);
    return res.status(200).json(sorted);
  } catch (err) {
    console.error("Error fetching published guidelines:", err);
    return res.status(500).json({ error: err.message });
  }
};

// GET ONE
const getGuidelineById = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id);

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    return res.status(200).json(guideline);
  } catch (err) {
    console.error("Error fetching guideline:", err);
    return res.status(500).json({ error: err.message });
  }
};

// VIEW COUNT
const incrementViews = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    return res.status(200).json(guideline);
  } catch (err) {
    console.error("Error incrementing views:", err);
    return res.status(500).json({ error: err.message });
  }
};

// EXPORT PUBLISHED GUIDELINES PDF
const exportPublishedGuidelinesPdf = async (req, res) => {
  try {
    const guidelines = await PostingGuideline.find({ status: "published" }).lean();
    const sorted = sortGuidelines(guidelines);

    const summary = sorted.reduce(
      (acc, item) => {
        acc.totalPublished += 1;
        acc.totalViews += Number(item.views || 0);

        const category = normalizeString(item.category).toLowerCase() || "general";
        acc.categories[category] = (acc.categories[category] || 0) + 1;

        const priority = normalizeString(item.priorityLevel).toLowerCase() || "medium";
        acc.priorities[priority] = (acc.priorities[priority] || 0) + 1;

        return acc;
      },
      {
        totalPublished: 0,
        totalViews: 0,
        categories: {
          earthquake: 0,
          flood: 0,
          typhoon: 0,
          general: 0,
        },
        priorities: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="published-guidelines-${new Date().toISOString().slice(0, 10)}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 30,
      bufferPages: true,
    });

    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(18).text("Published Guidelines Report", {
      align: "center",
    });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).text(
      "Generated from Disaster Relief Management System",
      { align: "center" }
    );

    drawPdfSectionTitle(doc, "Summary");
    drawPdfLabelValue(doc, "Total Published Guidelines", String(summary.totalPublished));
    drawPdfLabelValue(doc, "Total Views", String(summary.totalViews));
    drawPdfLabelValue(doc, "Earthquake", String(summary.categories.earthquake));
    drawPdfLabelValue(doc, "Flood", String(summary.categories.flood));
    drawPdfLabelValue(doc, "Typhoon", String(summary.categories.typhoon));
    drawPdfLabelValue(doc, "General", String(summary.categories.general));
    drawPdfLabelValue(doc, "Critical Priority", String(summary.priorities.critical));
    drawPdfLabelValue(doc, "High Priority", String(summary.priorities.high));
    drawPdfLabelValue(doc, "Medium Priority", String(summary.priorities.medium));
    drawPdfLabelValue(doc, "Low Priority", String(summary.priorities.low));

    drawPdfSectionTitle(doc, "Published Guidelines");

    const columns = [
      { label: "Title", key: "title", width: 170 },
      { label: "Category", key: "category", width: 80 },
      { label: "Priority", key: "priorityLevel", width: 70 },
      { label: "Status", key: "status", width: 70 },
      { label: "Views", key: "views", width: 50, align: "right" },
      { label: "Attachments", key: "attachmentCount", width: 65, align: "right" },
      { label: "Created", key: "createdAt", width: 95 },
      { label: "Updated", key: "updatedAt", width: 95 },
    ];

    if (!sorted.length) {
      doc.font("Helvetica").fontSize(10).text("No published guidelines available.");
    } else {
      drawSimpleTableHeader(doc, columns);

      sorted.forEach((item) => {
        drawSimpleTableRow(
          doc,
          columns,
          {
            title: normalizeString(item.title) || "-",
            category: formatLabel(item.category),
            priorityLevel: formatLabel(item.priorityLevel),
            status: formatLabel(item.status),
            views: Number(item.views || 0),
            attachmentCount: Array.isArray(item.attachments) ? item.attachments.length : 0,
            createdAt: formatDateValue(item.createdAt),
            updatedAt: formatDateValue(item.updatedAt),
          },
          26
        );
      });
    }

    const withDescriptions = sorted.filter((item) => normalizeString(item.description));

    if (withDescriptions.length) {
      drawPdfSectionTitle(doc, "Descriptions");

      withDescriptions.forEach((item, index) => {
        ensurePdfPageSpace(doc, 55);
        doc.font("Helvetica-Bold").fontSize(10).text(
          `${index + 1}. ${normalizeString(item.title) || "Untitled Guideline"}`
        );
        doc.font("Helvetica").fontSize(10).text(normalizeString(item.description));
        doc.moveDown(0.35);
      });
    }

    const withAttachments = sorted.filter(
      (item) => Array.isArray(item.attachments) && item.attachments.length > 0
    );

    if (withAttachments.length) {
      drawPdfSectionTitle(doc, "Attachment References");

      withAttachments.forEach((item, index) => {
        ensurePdfPageSpace(doc, 45);
        doc.font("Helvetica-Bold").fontSize(10).text(
          `${index + 1}. ${normalizeString(item.title) || "Untitled Guideline"}`
        );
        doc.font("Helvetica").fontSize(10).text(
          item.attachments
            .map((file) => normalizeString(file.fileName) || normalizeString(file.fileUrl) || "Unnamed attachment")
            .join(", ")
        );
        doc.moveDown(0.35);
      });
    }

    ensurePdfPageSpace(doc, 60);
    doc.moveDown(1);
    doc.font("Helvetica").fontSize(9).text(
      `Document generated on ${formatDateValue(new Date())}`,
      { align: "right" }
    );

    doc.end();
  } catch (err) {
    console.error("Error exporting published guidelines PDF:", err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
};

// UPDATE
const updateGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id);

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    const previousStatus = getGuidelineStatus(guideline);
    const previousPriority = getGuidelinePriority(guideline);

    let remainingAttachments = guideline.attachments || [];

    if (req.body.removeImages) {
      let removeList = [];

      try {
        removeList = JSON.parse(req.body.removeImages);
      } catch (parseErr) {
        return res.status(400).json({ error: "Invalid removeImages format" });
      }

      if (removeList.length > 0) {
        await Promise.all(
          removeList
            .filter((img) => img?.public_id)
            .map((img) => cloudinary.uploader.destroy(img.public_id))
        );

        remainingAttachments = remainingAttachments.filter(
          (img) => !removeList.some((r) => r.public_id === img.public_id)
        );
      }
    }

    const newAttachments = await uploadFilesToCloudinary(req.files || []);

    guideline.attachments = [...remainingAttachments, ...newAttachments];

    if (typeof req.body.title !== "undefined") guideline.title = req.body.title;
    if (typeof req.body.description !== "undefined") guideline.description = req.body.description;
    if (typeof req.body.category !== "undefined") guideline.category = req.body.category;
    if (typeof req.body.status !== "undefined") guideline.status = req.body.status;
    if (typeof req.body.priorityLevel !== "undefined") {
      guideline.priorityLevel = req.body.priorityLevel;
    }

    await guideline.save();

    await notifyGuidelineUpdated({
      req,
      guideline,
      previousStatus,
      previousPriority,
    });

    return res.status(200).json(guideline);
  } catch (err) {
    console.error("Error updating guideline:", err);
    return res.status(400).json({ error: err.message });
  }
};

// ARCHIVE
const archiveGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findByIdAndUpdate(
      req.params.id,
      { status: "archived" },
      { new: true }
    );

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    await notifyGuidelineArchived(req, guideline);

    return res.status(200).json(guideline);
  } catch (err) {
    console.error("Error archiving guideline:", err);
    return res.status(500).json({ error: err.message });
  }
};

// RESTORE
const restoreGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findByIdAndUpdate(
      req.params.id,
      { status: "draft" },
      { new: true }
    );

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    await notifyGuidelineRestored(req, guideline);

    return res.status(200).json(guideline);
  } catch (err) {
    console.error("Error restoring guideline:", err);
    return res.status(500).json({ error: err.message });
  }
};

// DELETE
const deleteGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id);

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    if (guideline.attachments?.length) {
      await Promise.all(
        guideline.attachments
          .filter((file) => file?.public_id)
          .map((file) => cloudinary.uploader.destroy(file.public_id))
      );
    }

    await notifyGuidelineDeleted(req, guideline);

    await PostingGuideline.findByIdAndDelete(req.params.id);

    return res.status(200).json({ message: "Guideline deleted successfully" });
  } catch (err) {
    console.error("Error deleting guideline:", err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createGuideline,
  getGuidelines,
  getPublishedGuidelines,
  getGuidelineById,
  incrementViews,
  exportPublishedGuidelinesPdf,
  updateGuideline,
  archiveGuideline,
  restoreGuideline,
  deleteGuideline,
};
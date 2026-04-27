const PDFDocument = require("pdfkit");
const InventoryItem = require("../models/InventoryItem");
const InventoryLog = require("../models/InventoryLog");
const Notification = require("../models/Notification");
const createNotification = require("../utils/createNotification");

const VALID_TYPES = ["goods", "monetary"];
const VALID_SOURCE_TYPES = ["external", "government", "internal"];
const LOW_STOCK_THRESHOLD = 20;

let aiCache = null;
let aiCacheTime = 0;
const AI_CACHE_MS = 6 * 60 * 60 * 1000;

const VALID_REPORT_TYPES = [
  "masterlist",
  "low_stock",
  "expired",
  "expiring_soon",
  "archived",
  "inventory_analytics",
  "donation_analytics",
  "donations",
  "goods_donations",
  "monetary_donations",
];

const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeLower = (value, fallback) => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).trim().toLowerCase();
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const parseDate = (value) => {
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "INVALID_DATE";
  }

  return parsed;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

const startOfWeek = (date) => {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return d;
};

const startOfMonth = (date) => {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
};

const getExpiryMeta = (expirationDate) => {
  if (!expirationDate) {
    return {
      expiryStatus: "no_expiry",
      daysUntilExpiration: null,
    };
  }

  const today = startOfDay(new Date());
  const expiry = startOfDay(expirationDate);

  const diffMs = expiry.getTime() - today.getTime();
  const daysUntilExpiration = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysUntilExpiration < 0) {
    return {
      expiryStatus: "expired",
      daysUntilExpiration,
    };
  }

  if (daysUntilExpiration <= 30) {
    return {
      expiryStatus: "expiring_soon",
      daysUntilExpiration,
    };
  }

  return {
    expiryStatus: "ok",
    daysUntilExpiration,
  };
};

const attachExpiryMeta = (item) => {
  const plain = item.toObject ? item.toObject() : { ...item };

  if (plain.type !== "goods") {
    return {
      ...plain,
      expiryStatus: null,
      daysUntilExpiration: null,
    };
  }

  const meta = getExpiryMeta(plain.expirationDate);

  return {
    ...plain,
    ...meta,
  };
};

const isLowStockItem = (item) => {
  const qty = Number(item.quantity || 0);
  return item.type === "goods" && qty > 0 && qty < LOW_STOCK_THRESHOLD;
};

const isOutOfStockItem = (item) => {
  const qty = Number(item.quantity || 0);
  return item.type === "goods" && qty <= 0;
};

const getSourceFallbackLabel = (sourceType) => {
  const normalized = normalizeString(sourceType).toLowerCase();

  if (normalized === "government") return "Government Source";
  if (normalized === "internal") return "Internal Source";
  return "External Donor";
};

const getPublicSourceName = (item) => {
  const sourceName = normalizeString(item.sourceName);
  if (sourceName) return sourceName;

  return getSourceFallbackLabel(item.sourceType);
};

const getDonorKey = (item) => {
  const sourceName = normalizeString(item.sourceName).toLowerCase();
  const sourceType = normalizeString(item.sourceType).toLowerCase() || "external";

  if (sourceName) {
    return `${sourceType}:${sourceName}`;
  }

  return `${sourceType}:__confidential__`;
};

const validateInventoryData = (body, isUpdate = false, currentType = null) => {
  const errors = [];

  const type = normalizeLower(body.type, currentType || "goods");
  const name = body.name !== undefined ? normalizeString(body.name) : undefined;
  const category =
    body.category !== undefined ? normalizeLower(body.category) : undefined;
  const quantity = body.quantity !== undefined ? toNumber(body.quantity) : undefined;
  const unit = body.unit !== undefined ? normalizeString(body.unit) : undefined;
  const amount = body.amount !== undefined ? toNumber(body.amount) : undefined;
  const expirationDate =
    body.expirationDate !== undefined ? parseDate(body.expirationDate) : undefined;
  const description =
    body.description !== undefined ? normalizeString(body.description) : undefined;
  const sourceType =
    body.sourceType !== undefined ? normalizeLower(body.sourceType) : undefined;
  const sourceName =
    body.sourceName !== undefined ? normalizeString(body.sourceName) : undefined;

  if (!VALID_TYPES.includes(type)) {
    errors.push("Invalid type. Must be goods or monetary.");
  }

  if (!isUpdate || body.name !== undefined) {
    if (!name) errors.push("Name is required.");
  }

  if (sourceType !== undefined && !VALID_SOURCE_TYPES.includes(sourceType)) {
    errors.push("Invalid sourceType. Must be external, government, or internal.");
  }

  if (body.expirationDate !== undefined && expirationDate === "INVALID_DATE") {
    errors.push("Invalid expiration date.");
  }

  if (type === "goods") {
    if (!isUpdate || body.category !== undefined) {
      if (!category) errors.push("Category is required for goods.");
    }

    if (!isUpdate || body.quantity !== undefined) {
      if (quantity === undefined || quantity < 0) {
        errors.push("Quantity is required for goods and must be 0 or higher.");
      }
    }

    if (!isUpdate || body.unit !== undefined) {
      if (!unit) errors.push("Unit is required for goods.");
    }
  }

  if (type === "monetary") {
    if (!isUpdate || body.amount !== undefined) {
      if (amount === undefined || amount < 0) {
        errors.push("Amount is required for monetary and must be 0 or higher.");
      }
    }

    if (body.expirationDate !== undefined && body.expirationDate !== "") {
      errors.push("Expiration date is only allowed for goods.");
    }
  }

  return {
    errors,
    data: {
      type,
      name,
      category,
      quantity,
      unit,
      amount,
      expirationDate,
      description,
      sourceType,
      sourceName,
    },
  };
};

const createLog = async (item, action, username, remarks = "") => {
  await InventoryLog.create({
    inventoryItem: item._id,
    itemName: item.name,
    itemType: item.type,
    action,
    quantity: item.type === "goods" ? item.quantity : undefined,
    amount: item.type === "monetary" ? item.amount : undefined,
    performedBy: username || "",
    remarks,
  });
};

const getNotificationDayKey = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

const createInventoryNotificationOnce = async ({
  type,
  priority = "normal",
  title,
  message,
  item,
  senderName = "",
  module = "inventory",
  metadata = {},
}) => {
  try {
    if (!item?._id || !type || !title || !message) return null;

    const dayKey = getNotificationDayKey();

    const existing = await Notification.findOne({
      recipientRole: "drrmo",
      module,
      type,
      referenceId: item._id,
      "metadata.dayKey": dayKey,
    }).lean();

    if (existing) return existing;

    return await createNotification({
      recipientRole: "drrmo",
      senderUser: null,
      senderRole: "drrmo",
      senderName,
      module,
      type,
      priority,
      title,
      message,
      link: module === "donation" ? "/drrmo/inventory/add" : "/drrmo/inventory",
      referenceId: item._id,
      referenceModel: "InventoryItem",
      metadata: {
        dayKey,
        itemId: item._id,
        itemName: item.name,
        itemType: item.type,
        category: item.category || "",
        quantity: item.quantity || 0,
        unit: item.unit || "",
        amount: item.amount || 0,
        sourceType: item.sourceType || "",
        sourceName: item.sourceName || "",
        expirationDate: item.expirationDate || null,
        ...metadata,
      },
    });
  } catch (err) {
    console.error("Create Inventory Notification Once Error:", err);
    return null;
  }
};

const notifyDonationCreated = async (item, username = "") => {
  try {
    if (!item?._id) return;

    if (item.type === "goods") {
      await createInventoryNotificationOnce({
        type: "goods_donation_added",
        module: "donation",
        priority: "normal",
        title: "Goods donation added",
        message: `${item.name} was added to inventory with ${Number(
          item.quantity || 0
        ).toLocaleString()} ${item.unit || "unit(s)"}.`,
        item,
        senderName: username,
        metadata: {
          donationType: "goods",
        },
      });

      return;
    }

    if (item.type === "monetary") {
      await createInventoryNotificationOnce({
        type: "monetary_donation_added",
        module: "donation",
        priority: "normal",
        title: "Monetary donation recorded",
        message: `A monetary donation worth PHP ${Number(
          item.amount || 0
        ).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} was recorded.`,
        item,
        senderName: username,
        metadata: {
          donationType: "monetary",
        },
      });
    }
  } catch (err) {
    console.error("Notify Donation Created Error:", err);
  }
};

const notifyInventoryRiskState = async (item, username = "") => {
  try {
    if (!item?._id || item.type !== "goods" || item.isArchive) return;

    const quantity = Number(item.quantity || 0);
    const expiryMeta = getExpiryMeta(item.expirationDate);

    if (quantity <= 0) {
      await createInventoryNotificationOnce({
        type: "inventory_out_of_stock",
        module: "inventory",
        priority: "critical",
        title: "Inventory item is out of stock",
        message: `${item.name} is now out of stock.`,
        item,
        senderName: username,
        metadata: {
          alertReason: "out_of_stock",
          lowStockThreshold: LOW_STOCK_THRESHOLD,
        },
      });
    } else if (quantity < LOW_STOCK_THRESHOLD) {
      await createInventoryNotificationOnce({
        type: "inventory_low_stock",
        module: "inventory",
        priority: "high",
        title: "Inventory item is low on stock",
        message: `${item.name} is low on stock with only ${quantity} ${
          item.unit || "unit(s)"
        } remaining.`,
        item,
        senderName: username,
        metadata: {
          alertReason: "low_stock",
          lowStockThreshold: LOW_STOCK_THRESHOLD,
        },
      });
    }

    if (expiryMeta.expiryStatus === "expired") {
      await createInventoryNotificationOnce({
        type: "inventory_expired",
        module: "inventory",
        priority: "critical",
        title: "Inventory item has expired",
        message: `${item.name} has expired and should not be released.`,
        item,
        senderName: username,
        metadata: {
          alertReason: "expired",
          expiryStatus: expiryMeta.expiryStatus,
          daysUntilExpiration: expiryMeta.daysUntilExpiration,
        },
      });
    }

    if (expiryMeta.expiryStatus === "expiring_soon") {
      await createInventoryNotificationOnce({
        type: "inventory_expiring_soon",
        module: "inventory",
        priority: "high",
        title: "Inventory item is expiring soon",
        message: `${item.name} will expire in ${expiryMeta.daysUntilExpiration} day(s).`,
        item,
        senderName: username,
        metadata: {
          alertReason: "expiring_soon",
          expiryStatus: expiryMeta.expiryStatus,
          daysUntilExpiration: expiryMeta.daysUntilExpiration,
        },
      });
    }
  } catch (err) {
    console.error("Notify Inventory Risk State Error:", err);
  }
};

// =========================
// PDF HELPERS
// =========================
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

const formatDateOnly = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
};

const formatTypeLabel = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return "-";

  return normalized.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatExpiryStatusLabel = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return "-";

  if (normalized === "expiring_soon") return "Expiring Soon";
  if (normalized === "no_expiry") return "No Expiry";
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatPeso = (value) => {
  return `PHP ${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

  doc
    .moveTo(startX, startY + 14)
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

  doc
    .moveTo(startX, startY + rowHeight - 4)
    .lineTo(doc.page.width - doc.page.margins.right, startY + rowHeight - 4)
    .strokeColor("#dddddd")
    .stroke()
    .strokeColor("#000000");

  doc.y = startY + rowHeight;
};

const getInventoryReportMeta = (reportType) => {
  switch (reportType) {
    case "low_stock":
      return {
        title: "Low Stock Inventory Report",
        filename: "inventory-low-stock",
      };

    case "expired":
      return {
        title: "Expired Inventory Report",
        filename: "inventory-expired",
      };

    case "expiring_soon":
      return {
        title: "Expiring Soon Inventory Report",
        filename: "inventory-expiring-soon",
      };

    case "archived":
      return {
        title: "Archived Inventory Report",
        filename: "inventory-archived",
      };

    case "inventory_analytics":
      return {
        title: "Inventory AI Analytics Report",
        filename: "inventory-ai-analytics",
      };

    case "donation_analytics":
      return {
        title: "Donation AI Analytics Report",
        filename: "donation-ai-analytics",
      };

    case "donations":
      return {
        title: "Donation Records Report",
        filename: "donation-records",
      };

    case "goods_donations":
      return {
        title: "Goods Donations Report",
        filename: "goods-donations",
      };

    case "monetary_donations":
      return {
        title: "Monetary Donations Report",
        filename: "monetary-donations",
      };

    case "masterlist":
    default:
      return {
        title: "Inventory Masterlist Report",
        filename: "inventory-masterlist",
      };
  }
};

const getInventoryItemsForReport = async (reportType) => {
  const isArchivedReport = reportType === "archived";

  const items = await InventoryItem.find({
    isArchive: isArchivedReport,
  }).sort({ createdAt: -1 });

  const enrichedItems = items.map((item) => attachExpiryMeta(item));

  switch (reportType) {
    case "low_stock":
      return enrichedItems.filter((item) => isLowStockItem(item));

    case "expired":
      return enrichedItems.filter(
        (item) => item.type === "goods" && item.expiryStatus === "expired"
      );

    case "expiring_soon":
      return enrichedItems.filter(
        (item) => item.type === "goods" && item.expiryStatus === "expiring_soon"
      );

    case "donations":
      return enrichedItems.filter(
        (item) => item.type === "goods" || item.type === "monetary"
      );

    case "goods_donations":
      return enrichedItems.filter((item) => item.type === "goods");

    case "monetary_donations":
      return enrichedItems.filter((item) => item.type === "monetary");

    case "archived":
      return enrichedItems;

    case "masterlist":
    default:
      return enrichedItems;
  }
};

const buildInventorySummary = (items = []) => {
  return items.reduce(
    (acc, item) => {
      acc.totalEntries += 1;

      if (item.type === "goods") {
        acc.goodsEntries += 1;
        acc.totalGoodsQuantity += Number(item.quantity || 0);

        if (item.expiryStatus === "expired") acc.expiredGoods += 1;
        if (item.expiryStatus === "expiring_soon") acc.expiringSoonGoods += 1;
        if (isLowStockItem(item)) acc.lowStockGoods += 1;
      }

      if (item.type === "monetary") {
        acc.monetaryEntries += 1;
        acc.totalMonetaryAmount += Number(item.amount || 0);
      }

      return acc;
    },
    {
      totalEntries: 0,
      goodsEntries: 0,
      monetaryEntries: 0,
      totalGoodsQuantity: 0,
      totalMonetaryAmount: 0,
      expiredGoods: 0,
      expiringSoonGoods: 0,
      lowStockGoods: 0,
    }
  );
};

// =========================
// ANALYTICS HELPERS
// =========================
const getDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const summarizeDonationPeriod = (items = [], startDate, endDate) => {
  return items.reduce(
    (acc, item) => {
      const createdAt = item.createdAt ? new Date(item.createdAt) : null;
      if (!createdAt || Number.isNaN(createdAt.getTime())) return acc;
      if (createdAt < startDate || createdAt > endDate) return acc;

      acc.totalDonations += 1;

      if (item.type === "goods") {
        acc.goodsDonations += 1;
        acc.goodsQuantity += Number(item.quantity || 0);
      }

      if (item.type === "monetary") {
        acc.monetaryDonations += 1;
        acc.monetaryAmount += Number(item.amount || 0);
      }

      return acc;
    },
    {
      totalDonations: 0,
      goodsDonations: 0,
      goodsQuantity: 0,
      monetaryDonations: 0,
      monetaryAmount: 0,
    }
  );
};

const sortByNumberDesc = (list, field) => {
  return [...list].sort((a, b) => Number(b[field] || 0) - Number(a[field] || 0));
};

const buildAnalyticsSnapshot = async () => {
  const activeItems = await InventoryItem.find({ isArchive: false }).lean();
  const archivedItems = await InventoryItem.countDocuments({ isArchive: true });

  const goodsItems = activeItems.filter((item) => item.type === "goods");
  const monetaryItems = activeItems.filter((item) => item.type === "monetary");

  const categoryStats = {};
  goodsItems.forEach((item) => {
    const category = normalizeString(item.category).toLowerCase() || "uncategorized";
    categoryStats[category] =
      Number(categoryStats[category] || 0) + Number(item.quantity || 0);
  });

  const sourceStats = {
    external: 0,
    government: 0,
    internal: 0,
  };

  activeItems.forEach((item) => {
    const sourceType = normalizeString(item.sourceType).toLowerCase() || "external";
    if (sourceStats[sourceType] !== undefined) {
      sourceStats[sourceType] += 1;
    }
  });

  const summary = activeItems.reduce(
    (acc, item) => {
      acc.totalEntries += 1;

      if (item.type === "goods") {
        acc.goodsEntries += 1;
        acc.activeGoods += 1;
        acc.totalGoodsQuantity += Number(item.quantity || 0);

        const expiryMeta = getExpiryMeta(item.expirationDate);

        if (isLowStockItem(item)) acc.lowStockGoods += 1;
        if (isOutOfStockItem(item)) acc.outOfStockGoods += 1;
        if (expiryMeta.expiryStatus === "expired") acc.expiredGoods += 1;
        if (expiryMeta.expiryStatus === "expiring_soon") acc.expiringSoonGoods += 1;
        if (expiryMeta.expiryStatus === "no_expiry") acc.noExpiryGoods += 1;
        if (expiryMeta.expiryStatus === "ok") acc.safeExpiryGoods += 1;
      }

      if (item.type === "monetary") {
        acc.monetaryEntries += 1;
        acc.activeMonetary += 1;
        acc.totalMonetaryAmount += Number(item.amount || 0);
      }

      return acc;
    },
    {
      totalEntries: 0,
      goodsEntries: 0,
      monetaryEntries: 0,
      activeGoods: 0,
      activeMonetary: 0,
      totalGoodsQuantity: 0,
      totalMonetaryAmount: 0,
      lowStockGoods: 0,
      outOfStockGoods: 0,
      expiredGoods: 0,
      expiringSoonGoods: 0,
      noExpiryGoods: 0,
      safeExpiryGoods: 0,
      archivedItems,
    }
  );

  summary.needsAttention =
    summary.lowStockGoods +
    summary.outOfStockGoods +
    summary.expiredGoods +
    summary.expiringSoonGoods;

  const now = new Date();
  const todayEnd = endOfDay(now);

  const donationActivity = {
    today: summarizeDonationPeriod(activeItems, startOfDay(now), todayEnd),
    thisWeek: summarizeDonationPeriod(activeItems, startOfWeek(now), todayEnd),
    thisMonth: summarizeDonationPeriod(activeItems, startOfMonth(now), todayEnd),
  };

  return {
    generatedAt: new Date(),
    summary,
    categoryStats,
    sourceStats,
    donationActivity,
    ai: aiCache || null,
    goodsItems,
    monetaryItems,
  };
};

const drawAnalyticsSnapshotPdf = (doc, snapshot, reportType) => {
  const { summary, categoryStats, sourceStats, donationActivity, ai } = snapshot;

  drawPdfSectionTitle(doc, "AI Analytics Summary");
  drawPdfLabelValue(doc, "Generated At", formatDateValue(snapshot.generatedAt));

  if (ai) {
    drawPdfLabelValue(doc, "AI Source", ai.aiAvailable ? "Gemini AI" : "Rule-based Fallback");
    drawPdfLabelValue(doc, "Overall Severity", formatTypeLabel(ai.overallSeverity));
    drawPdfLabelValue(doc, "Executive Summary", ai.executiveSummary || "-");
  } else {
    drawPdfLabelValue(doc, "AI Source", "Not yet generated");
    drawPdfLabelValue(
      doc,
      "Executive Summary",
      "Open the analytics dashboard first to generate cached AI insights."
    );
  }

  drawPdfSectionTitle(doc, "Key Metrics");

  if (reportType === "donation_analytics") {
    drawPdfLabelValue(doc, "Monetary Entries", String(summary.monetaryEntries));
    drawPdfLabelValue(doc, "Total Monetary Amount", formatPeso(summary.totalMonetaryAmount));
    drawPdfLabelValue(doc, "Goods Donation Entries", String(summary.goodsEntries));
    drawPdfLabelValue(doc, "Total Goods Quantity", String(summary.totalGoodsQuantity));
    drawPdfLabelValue(doc, "Donations Today", String(donationActivity.today.totalDonations));
    drawPdfLabelValue(
      doc,
      "Donations This Week",
      String(donationActivity.thisWeek.totalDonations)
    );
    drawPdfLabelValue(
      doc,
      "Donations This Month",
      String(donationActivity.thisMonth.totalDonations)
    );
    drawPdfLabelValue(
      doc,
      "Goods Quantity This Week",
      String(donationActivity.thisWeek.goodsQuantity)
    );
    drawPdfLabelValue(
      doc,
      "Monetary Amount This Week",
      formatPeso(donationActivity.thisWeek.monetaryAmount)
    );
  } else {
    drawPdfLabelValue(doc, "Active Goods", String(summary.activeGoods));
    drawPdfLabelValue(doc, "Total Goods Quantity", String(summary.totalGoodsQuantity));
    drawPdfLabelValue(doc, "Needs Attention", String(summary.needsAttention));
    drawPdfLabelValue(doc, "Low Stock Goods", String(summary.lowStockGoods));
    drawPdfLabelValue(doc, "Out of Stock Goods", String(summary.outOfStockGoods));
    drawPdfLabelValue(doc, "Expired Goods", String(summary.expiredGoods));
    drawPdfLabelValue(doc, "Expiring Soon Goods", String(summary.expiringSoonGoods));
    drawPdfLabelValue(doc, "No Expiry Goods", String(summary.noExpiryGoods));
    drawPdfLabelValue(doc, "Archived Items", String(summary.archivedItems));
  }

  drawPdfSectionTitle(doc, "Category Distribution");

  const categoryRows = Object.entries(categoryStats)
    .map(([category, quantity]) => ({
      category: formatTypeLabel(category),
      quantity,
    }))
    .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));

  if (!categoryRows.length) {
    doc.font("Helvetica").fontSize(10).text("No category distribution available.");
  } else {
    const columns = [
      { label: "Category", key: "category", width: 250 },
      { label: "Quantity", key: "quantity", width: 100, align: "right" },
    ];

    drawSimpleTableHeader(doc, columns);

    categoryRows.forEach((row) => {
      drawSimpleTableRow(doc, columns, row, 24);
    });
  }

  drawPdfSectionTitle(doc, "Source Distribution");
  drawPdfLabelValue(doc, "External", String(sourceStats.external));
  drawPdfLabelValue(doc, "Government", String(sourceStats.government));
  drawPdfLabelValue(doc, "Internal", String(sourceStats.internal));

  if (ai?.priorityActions?.length) {
    drawPdfSectionTitle(doc, "AI Priority Actions");

    ai.priorityActions.slice(0, 5).forEach((action, index) => {
      ensurePdfPageSpace(doc, 28);
      doc.font("Helvetica").fontSize(10).text(`${index + 1}. ${action}`);
    });
  }

  if (ai?.insights?.length) {
    drawPdfSectionTitle(doc, "AI Insights");

    ai.insights.slice(0, 6).forEach((insight, index) => {
      ensurePdfPageSpace(doc, 72);
      doc.font("Helvetica-Bold").fontSize(10).text(`${index + 1}. ${insight.title || "Insight"}`);
      doc.font("Helvetica").fontSize(9).text(`Severity: ${formatTypeLabel(insight.severity)}`);
      doc.font("Helvetica").fontSize(9).text(`Message: ${insight.message || "-"}`);
      doc.font("Helvetica").fontSize(9).text(`Action: ${insight.action || "-"}`);
      doc.moveDown(0.4);
    });
  }
};

// =========================
// ANALYTICS CONTROLLERS
// =========================
const getInventorySummary = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false }).lean();

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const summary = items.reduce(
      (acc, item) => {
        acc.totalEntries += 1;

        if (item.type === "goods") {
          acc.goodsEntries += 1;
                    acc.totalGoodsQuantity += Number(item.quantity || 0);

          const expiryMeta = getExpiryMeta(item.expirationDate);
          if (expiryMeta.expiryStatus === "expired") acc.expiredGoods += 1;
          if (expiryMeta.expiryStatus === "expiring_soon") acc.expiringSoonGoods += 1;
          if (isLowStockItem(item)) acc.lowStockGoods += 1;
          if (isOutOfStockItem(item)) acc.outOfStockGoods += 1;
        }

        if (item.type === "monetary") {
          acc.monetaryEntries += 1;
          acc.totalMonetaryAmount += Number(item.amount || 0);
        }

        if (item.createdAt && new Date(item.createdAt) >= sevenDaysAgo) {
          acc.recentDonations += 1;
        }

        return acc;
      },
      {
        totalEntries: 0,
        goodsEntries: 0,
        monetaryEntries: 0,
        totalGoodsQuantity: 0,
        totalMonetaryAmount: 0,
        recentDonations: 0,
        expiredGoods: 0,
        expiringSoonGoods: 0,
        lowStockGoods: 0,
        outOfStockGoods: 0,
      }
    );

    res.json(summary);
  } catch (err) {
    console.error("Get Inventory Summary Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryCategoryStats = async (req, res) => {
  try {
    const items = await InventoryItem.find({
      isArchive: false,
      type: "goods",
    }).lean();

    const result = {};

    items.forEach((item) => {
      const category = String(item.category || "").toLowerCase();

      if (!result[category]) {
        result[category] = 0;
      }

      result[category] += Number(item.quantity || 0);
    });

    res.json(result);
  } catch (err) {
    console.error("Get Inventory Category Stats Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getInventorySourceStats = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false }).lean();

    const result = {
      external: 0,
      government: 0,
      internal: 0,
    };

    items.forEach((item) => {
      const sourceType = String(item.sourceType || "").toLowerCase();
      if (result[sourceType] !== undefined) {
        result[sourceType] += 1;
      }
    });

    res.json(result);
  } catch (err) {
    console.error("Get Inventory Source Stats Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryRecentTrend = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false })
      .sort({ createdAt: 1 })
      .lean();

    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 6);

    const dateMap = {};

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      dateMap[getDateKey(day)] = 0;
    }

    items.forEach((item) => {
      if (!item.createdAt) return;

      const key = getDateKey(item.createdAt);
      if (dateMap[key] !== undefined) {
        dateMap[key] += 1;
      }
    });

    const trend = Object.entries(dateMap).map(([date, count]) => ({
      _id: date,
      count,
    }));

    res.json(trend);
  } catch (err) {
    console.error("Get Inventory Recent Trend Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryHealth = async (req, res) => {
  try {
    const activeItems = await InventoryItem.find({ isArchive: false }).lean();
    const archivedItems = await InventoryItem.countDocuments({ isArchive: true });

    const result = activeItems.reduce(
      (acc, item) => {
        acc.activeItems += 1;

        if (item.type === "goods") {
          acc.activeGoods += 1;

          const expiryMeta = getExpiryMeta(item.expirationDate);

          if (isLowStockItem(item)) acc.lowStockGoods += 1;
          if (isOutOfStockItem(item)) acc.outOfStockGoods += 1;
          if (expiryMeta.expiryStatus === "expired") acc.expiredGoods += 1;
          if (expiryMeta.expiryStatus === "expiring_soon") acc.expiringSoonGoods += 1;
          if (expiryMeta.expiryStatus === "no_expiry") acc.noExpiryGoods += 1;
          if (expiryMeta.expiryStatus === "ok") acc.safeExpiryGoods += 1;
        }

        if (item.type === "monetary") {
          acc.activeMonetary += 1;
        }

        return acc;
      },
      {
        activeItems: 0,
        activeGoods: 0,
        activeMonetary: 0,
        lowStockGoods: 0,
        outOfStockGoods: 0,
        expiredGoods: 0,
        expiringSoonGoods: 0,
        noExpiryGoods: 0,
        safeExpiryGoods: 0,
        archivedItems: 0,
      }
    );

    result.archivedItems = archivedItems;
    result.needsAttention =
      result.lowStockGoods +
      result.outOfStockGoods +
      result.expiredGoods +
      result.expiringSoonGoods;

    res.json(result);
  } catch (err) {
    console.error("Get Inventory Health Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getTopDonors = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false })
      .sort({ createdAt: -1 })
      .lean();

    const donorMap = {};

    items.forEach((item) => {
      const key = getDonorKey(item);
      const sourceType = normalizeString(item.sourceType).toLowerCase() || "external";
      const displayName = getPublicSourceName(item);

      if (!donorMap[key]) {
        donorMap[key] = {
          name: displayName,
          sourceType,
          isConfidential: !normalizeString(item.sourceName),
          donationCount: 0,
          goodsDonationCount: 0,
          monetaryDonationCount: 0,
          totalQuantity: 0,
          totalAmount: 0,
          categories: {},
          lastDonationDate: null,
        };
      }

      donorMap[key].donationCount += 1;

      if (item.type === "goods") {
        donorMap[key].goodsDonationCount += 1;
        donorMap[key].totalQuantity += Number(item.quantity || 0);

        const category = normalizeString(item.category).toLowerCase() || "uncategorized";
        donorMap[key].categories[category] =
          Number(donorMap[key].categories[category] || 0) + Number(item.quantity || 0);
      }

      if (item.type === "monetary") {
        donorMap[key].monetaryDonationCount += 1;
        donorMap[key].totalAmount += Number(item.amount || 0);
      }

      const createdAt = item.createdAt ? new Date(item.createdAt) : null;
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        if (
          !donorMap[key].lastDonationDate ||
          createdAt > new Date(donorMap[key].lastDonationDate)
        ) {
          donorMap[key].lastDonationDate = createdAt;
        }
      }
    });

    const donors = Object.values(donorMap).map((donor) => {
      const topCategoryEntry = Object.entries(donor.categories || {}).sort(
        (a, b) => Number(b[1] || 0) - Number(a[1] || 0)
      )[0];

      return {
        ...donor,
        topCategory: topCategoryEntry ? topCategoryEntry[0] : "",
        topCategoryQuantity: topCategoryEntry ? topCategoryEntry[1] : 0,
      };
    });

    const topMonetaryDonors = sortByNumberDesc(
      donors.filter((donor) => Number(donor.totalAmount || 0) > 0),
      "totalAmount"
    ).slice(0, 5);

    const topGoodsDonors = sortByNumberDesc(
      donors.filter((donor) => Number(donor.totalQuantity || 0) > 0),
      "totalQuantity"
    ).slice(0, 5);

    const frequentDonors = sortByNumberDesc(
      donors.filter((donor) => Number(donor.donationCount || 0) > 0),
      "donationCount"
    ).slice(0, 5);

    res.json({
      totalDonorGroups: donors.length,
      topMonetaryDonors,
      topGoodsDonors,
      frequentDonors,
    });
  } catch (err) {
    console.error("Get Top Donors Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getDonationActivity = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false }).lean();

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const today = summarizeDonationPeriod(items, todayStart, todayEnd);
    const thisWeek = summarizeDonationPeriod(items, weekStart, todayEnd);
    const thisMonth = summarizeDonationPeriod(items, monthStart, todayEnd);

    const sourceBreakdown = {
      external: { totalDonations: 0, goodsQuantity: 0, monetaryAmount: 0 },
      government: { totalDonations: 0, goodsQuantity: 0, monetaryAmount: 0 },
      internal: { totalDonations: 0, goodsQuantity: 0, monetaryAmount: 0 },
    };

    const categoryBreakdown = {};

    items.forEach((item) => {
      const sourceType = normalizeString(item.sourceType).toLowerCase() || "external";

      if (sourceBreakdown[sourceType]) {
        sourceBreakdown[sourceType].totalDonations += 1;

        if (item.type === "goods") {
          sourceBreakdown[sourceType].goodsQuantity += Number(item.quantity || 0);
        }

        if (item.type === "monetary") {
          sourceBreakdown[sourceType].monetaryAmount += Number(item.amount || 0);
        }
      }

      if (item.type === "goods") {
        const category = normalizeString(item.category).toLowerCase() || "uncategorized";

        if (!categoryBreakdown[category]) {
          categoryBreakdown[category] = {
            category,
            donationCount: 0,
            totalQuantity: 0,
          };
        }

        categoryBreakdown[category].donationCount += 1;
        categoryBreakdown[category].totalQuantity += Number(item.quantity || 0);
      }
    });

    const topDonatedCategories = Object.values(categoryBreakdown)
      .sort((a, b) => Number(b.totalQuantity || 0) - Number(a.totalQuantity || 0))
      .slice(0, 5);

    res.json({
      today,
      thisWeek,
      thisMonth,

      donationsToday: today.totalDonations,
      donationsThisWeek: thisWeek.totalDonations,
      donationsThisMonth: thisMonth.totalDonations,

      monetaryToday: today.monetaryAmount,
      monetaryThisWeek: thisWeek.monetaryAmount,
      monetaryThisMonth: thisMonth.monetaryAmount,

      goodsQuantityToday: today.goodsQuantity,
      goodsQuantityThisWeek: thisWeek.goodsQuantity,
      goodsQuantityThisMonth: thisMonth.goodsQuantity,

      sourceBreakdown,
      topDonatedCategories,
    });
  } catch (err) {
    console.error("Get Donation Activity Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryAiInsights = async (req, res) => {
  if (aiCache && Date.now() - aiCacheTime < AI_CACHE_MS) {
    return res.json({
      ...aiCache,
      cacheHit: true,
      cacheAgeMs: Date.now() - aiCacheTime,
    });
  }

  function parseGeminiJson(rawText = "") {
    try {
      if (!rawText) return null;

      let cleaned = String(rawText)
        .trim()
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");

      if (start >= 0 && end > start) {
        cleaned = cleaned.slice(start, end + 1);
      }

      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

      return JSON.parse(cleaned);
    } catch (err) {
      console.error("Gemini JSON parse error:", err);
      return null;
    }
  }

  const buildRuleBasedFallback = ({
    items,
    goodsItems,
    monetaryItems,
    thisWeek,
    thisMonth,
    lowStockItems,
    outOfStockItems,
    expiredItems,
        expiringSoonItems,
    noExpiryItems,
    lowestCategories,
    highestCategories,
    totalMonetaryAmount,
    fallbackReason = "",
  }) => {
    const insights = [];

    if (outOfStockItems.length > 0) {
      insights.push({
        type: "out_of_stock",
        severity: "critical",
        title: "Some goods are already out of stock",
        message: `${outOfStockItems.length} goods item${
          outOfStockItems.length === 1 ? " is" : "s are"
        } at zero quantity.`,
        action: "Review these items immediately before approving new release plans.",
      });
    }

    if (lowStockItems.length > 0) {
      insights.push({
        type: "low_stock",
        severity: "warning",
        title: "Low stock needs attention",
        message: `${lowStockItems.length} goods item${
          lowStockItems.length === 1 ? " is" : "s are"
        } below the ${LOW_STOCK_THRESHOLD}-unit stock threshold.`,
        action: "Prioritize replenishment or reserve these items for high-priority requests.",
      });
    }

    if (expiredItems.length > 0) {
      insights.push({
        type: "expired",
        severity: "critical",
        title: "Expired goods found",
        message: `${expiredItems.length} goods item${
          expiredItems.length === 1 ? " has" : "s have"
        } expired and should not be released.`,
        action: "Separate expired items from release planning and update inventory records.",
      });
    }

    if (expiringSoonItems.length > 0) {
      insights.push({
        type: "expiring_soon",
        severity: "warning",
        title: "Goods are expiring soon",
        message: `${expiringSoonItems.length} goods item${
          expiringSoonItems.length === 1 ? " is" : "s are"
        } expiring within 30 days.`,
        action: "Use valid soon-to-expire goods first if they are still safe and appropriate.",
      });
    }

    if (noExpiryItems.length > 0) {
      insights.push({
        type: "missing_expiry",
        severity: "notice",
        title: "Some goods have no expiry date",
        message: `${noExpiryItems.length} goods item${
          noExpiryItems.length === 1 ? " has" : "s have"
        } no recorded expiration date.`,
        action: "Verify expiry dates for food and medicine-related inventory items.",
      });
    }

    if (thisWeek.totalDonations === 0) {
      insights.push({
        type: "no_recent_donations",
        severity: "notice",
        title: "No donations recorded this week",
        message: "There are no active inventory donation entries recorded for the current week.",
        action: "Check if recent donations were encoded or encourage additional donation intake.",
      });
    }

    if (thisMonth.monetaryAmount > 0 && thisWeek.monetaryAmount === 0) {
      insights.push({
        type: "monetary_slowdown",
        severity: "notice",
        title: "Monetary donations slowed this week",
        message: "Monetary donations exist this month, but none were recorded this week.",
        action: "Review recent donation activity and update pending monetary entries if needed.",
      });
    }

    if (lowestCategories.length > 0) {
      const lowest = lowestCategories[0];

      insights.push({
        type: "lowest_category",
        severity: Number(lowest.quantity || 0) < LOW_STOCK_THRESHOLD ? "warning" : "info",
        title: "Lowest stocked category identified",
        message: `${formatTypeLabel(lowest.category)} currently has ${
          lowest.quantity
        } total unit${Number(lowest.quantity || 0) === 1 ? "" : "s"} recorded.`,
        action: "Compare this with expected relief demand before approving large releases.",
      });
    }

    if (highestCategories.length > 0) {
      const highest = highestCategories[0];

      insights.push({
        type: "highest_category",
        severity: "info",
        title: "Most available goods category",
        message: `${formatTypeLabel(highest.category)} has the highest recorded stock at ${
          highest.quantity
        } total units.`,
        action: "Consider this category first when preparing general relief assistance.",
      });
    }

    if (!insights.length) {
      insights.push({
        type: "stable_inventory",
        severity: "success",
        title: "Inventory status looks stable",
        message: "No urgent inventory warnings were detected from current records.",
        action: "Continue monitoring new donations, expiry dates, and release demand.",
      });
    }

    const severityRank = {
      critical: 4,
      warning: 3,
      notice: 2,
      info: 1,
      success: 0,
    };

    const overallSeverity = insights.reduce((highest, insight) => {
      return severityRank[insight.severity] > severityRank[highest]
        ? insight.severity
        : highest;
    }, "success");

    return {
      generatedAt: new Date(),
      source: "rule_based_fallback",
      model: "local_rules",
      aiAvailable: false,
      overallSeverity,
      executiveSummary:
        fallbackReason ||
        (overallSeverity === "critical"
          ? "Inventory needs immediate review because critical stock or expiry issues were detected."
          : overallSeverity === "warning"
          ? "Inventory is usable, but some stock and donation indicators need attention."
          : "Inventory status appears generally stable based on current records."),
      priorityActions: insights.slice(0, 4).map((item) => item.action),
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      summary: {
        totalActiveItems: items.length,
        totalGoodsItems: goodsItems.length,
        totalMonetaryItems: monetaryItems.length,
        totalMonetaryAmount,
        donationsThisWeek: thisWeek.totalDonations,
        donationsThisMonth: thisMonth.totalDonations,
        lowStockGoods: lowStockItems.length,
        outOfStockGoods: outOfStockItems.length,
        expiredGoods: expiredItems.length,
        expiringSoonGoods: expiringSoonItems.length,
        noExpiryGoods: noExpiryItems.length,
      },
      lowestCategories,
      highestCategories,
      insights,
      fallbackReason,
      cacheHit: false,
    };
  };

  const callGeminiForInsights = async (facts) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const { GoogleGenerativeAI } = require("@google/generative-ai");

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.15,
        topP: 0.8,
        maxOutputTokens: 900,
      },
    });

    const prompt = `
Return ONLY valid minified JSON. No markdown. No explanation. No code fences.

You are an AI analytics assistant for a DRRMO disaster relief management system.
Analyze only the provided inventory facts. Do not invent records.

JSON shape:
{"overallSeverity":"success|info|notice|warning|critical","executiveSummary":"1 to 3 short sentences","priorityActions":["action 1","action 2","action 3"],"insights":[{"type":"short_snake_case","severity":"success|info|notice|warning|critical","title":"short title","message":"short data-based explanation","action":"specific recommended action"}]}

Rules:
- Make 3 to 5 insights only.
- Keep messages short.
- Mention low stock, expired goods, expiring goods, missing expiry, donation slowdown, or stock readiness only when supported by facts.
- Do not mention barangays or relief requests.

Facts:
${JSON.stringify(facts)}
`;

    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || "";
    const parsed = parseGeminiJson(text);

    if (!parsed || !Array.isArray(parsed.insights)) return null;

    const allowedSeverities = ["success", "info", "notice", "warning", "critical"];

    const safeInsights = parsed.insights
      .filter((item) => item && typeof item === "object")
      .slice(0, 5)
      .map((item, index) => {
        const severity = allowedSeverities.includes(item.severity) ? item.severity : "info";

        return {
          type: normalizeString(item.type) || `ai_insight_${index + 1}`,
          severity,
          title: normalizeString(item.title) || "AI insight",
          message:
            normalizeString(item.message) ||
            "The AI found an operational pattern in current inventory records.",
          action:
            normalizeString(item.action) ||
            "Review this area before making operational decisions.",
        };
      });

    if (!safeInsights.length) return null;

    const severityRank = {
      critical: 4,
      warning: 3,
      notice: 2,
      info: 1,
      success: 0,
    };

    const overallSeverity = allowedSeverities.includes(parsed.overallSeverity)
      ? parsed.overallSeverity
      : safeInsights.reduce((highest, insight) => {
          return severityRank[insight.severity] > severityRank[highest]
            ? insight.severity
            : highest;
        }, "success");

    return {
      source: "gemini",
      model: modelName,
      aiAvailable: true,
      overallSeverity,
      executiveSummary:
        normalizeString(parsed.executiveSummary) ||
        "AI reviewed the current inventory records for operational risks.",
      priorityActions: Array.isArray(parsed.priorityActions)
        ? parsed.priorityActions.map((item) => normalizeString(item)).filter(Boolean).slice(0, 5)
        : safeInsights.slice(0, 4).map((item) => item.action),
      insights: safeInsights,
      cacheHit: false,
    };
  };

  try {
    const items = await InventoryItem.find({ isArchive: false }).lean();

    const now = new Date();
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    const thisWeek = summarizeDonationPeriod(items, weekStart, todayEnd);
    const thisMonth = summarizeDonationPeriod(items, monthStart, todayEnd);

    const goodsItems = items.filter((item) => item.type === "goods");
    const monetaryItems = items.filter((item) => item.type === "monetary");

    const lowStockItems = goodsItems.filter((item) => isLowStockItem(item));
    const outOfStockItems = goodsItems.filter((item) => isOutOfStockItem(item));
    const expiredItems = goodsItems.filter(
      (item) => getExpiryMeta(item.expirationDate).expiryStatus === "expired"
    );
    const expiringSoonItems = goodsItems.filter(
      (item) => getExpiryMeta(item.expirationDate).expiryStatus === "expiring_soon"
    );
    const noExpiryItems = goodsItems.filter(
      (item) => getExpiryMeta(item.expirationDate).expiryStatus === "no_expiry"
    );

    const categoryTotals = {};
    goodsItems.forEach((item) => {
      const category = normalizeString(item.category).toLowerCase() || "uncategorized";
      categoryTotals[category] =
        Number(categoryTotals[category] || 0) + Number(item.quantity || 0);
    });

    const lowestCategories = Object.entries(categoryTotals)
      .map(([category, quantity]) => ({ category, quantity }))
      .sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0))
      .slice(0, 5);

    const highestCategories = Object.entries(categoryTotals)
      .map(([category, quantity]) => ({ category, quantity }))
      .sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))
      .slice(0, 5);

    const totalMonetaryAmount = monetaryItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const facts = {
      generatedAt: new Date(),
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      totalActiveItems: items.length,
      totalGoodsItems: goodsItems.length,
      totalMonetaryItems: monetaryItems.length,
      totalMonetaryAmount,
      donationsThisWeek: thisWeek.totalDonations,
      donationGoodsQuantityThisWeek: thisWeek.goodsQuantity,
      donationMonetaryAmountThisWeek: thisWeek.monetaryAmount,
      donationsThisMonth: thisMonth.totalDonations,
      donationGoodsQuantityThisMonth: thisMonth.goodsQuantity,
      donationMonetaryAmountThisMonth: thisMonth.monetaryAmount,
      lowStockGoods: lowStockItems.length,
      outOfStockGoods: outOfStockItems.length,
      expiredGoods: expiredItems.length,
      expiringSoonGoods: expiringSoonItems.length,
      noExpiryGoods: noExpiryItems.length,
      lowestCategories,
      highestCategories,
      examples: {
        lowStockItems: lowStockItems.slice(0, 5).map((item) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
        })),
        expiredItems: expiredItems.slice(0, 5).map((item) => ({
          name: item.name,
          category: item.category,
          expirationDate: item.expirationDate,
        })),
        expiringSoonItems: expiringSoonItems.slice(0, 5).map((item) => ({
          name: item.name,
          category: item.category,
          expirationDate: item.expirationDate,
          daysUntilExpiration: getExpiryMeta(item.expirationDate).daysUntilExpiration,
        })),
      },
    };

    const fallback = buildRuleBasedFallback({
      items,
      goodsItems,
      monetaryItems,
      thisWeek,
      thisMonth,
      lowStockItems,
      outOfStockItems,
      expiredItems,
      expiringSoonItems,
      noExpiryItems,
      lowestCategories,
      highestCategories,
      totalMonetaryAmount,
    });

    let aiResult = null;
    let fallbackReason = "";

    try {
      aiResult = await callGeminiForInsights(facts);
    } catch (geminiError) {
      console.error("Gemini Inventory AI Error:", geminiError);

      if (geminiError?.status === 429) {
        fallbackReason =
          "Gemini free quota was reached. Showing locally generated inventory intelligence instead.";
      } else {
        fallbackReason =
          "Gemini was unavailable. Showing locally generated inventory intelligence instead.";
      }
    }

    const finalPayload = aiResult
      ? {
          ...fallback,
          source: aiResult.source,
          model: aiResult.model,
          aiAvailable: true,
          overallSeverity: aiResult.overallSeverity,
          executiveSummary: aiResult.executiveSummary,
          priorityActions: aiResult.priorityActions,
          insights: aiResult.insights,
          fallbackReason: "",
          cacheHit: false,
        }
      : {
          ...fallback,
          aiAvailable: false,
          fallbackReason:
            fallbackReason ||
            (process.env.GEMINI_API_KEY
              ? "Gemini did not return a valid response, so rule-based fallback was used."
              : "GEMINI_API_KEY is missing, so rule-based fallback was used."),
          executiveSummary: fallbackReason || fallback.executiveSummary,
          cacheHit: false,
        };

    aiCache = finalPayload;
    aiCacheTime = Date.now();

    return res.json(finalPayload);
  } catch (err) {
    console.error("Get Inventory AI Insights Error:", err);
    return res.status(500).json({ message: err.message });
  }
};

// =========================
// EXPORT PDF
// =========================
const exportInventoryPdf = async (req, res) => {
  try {
    const reportType = normalizeLower(req.query.reportType, "masterlist");

    if (!VALID_REPORT_TYPES.includes(reportType)) {
      return res.status(400).json({
        message:
          "Invalid reportType. Use masterlist, low_stock, expired, expiring_soon, archived, inventory_analytics, donation_analytics, donations, goods_donations, or monetary_donations.",
      });
    }

    const reportMeta = getInventoryReportMeta(reportType);

    if (reportType === "inventory_analytics" || reportType === "donation_analytics") {
      const snapshot = await buildAnalyticsSnapshot();

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${reportMeta.filename}-${new Date()
          .toISOString()
          .slice(0, 10)}.pdf"`
      );

      const doc = new PDFDocument({
                size: "A4",
        layout: "portrait",
        margin: 36,
        bufferPages: true,
      });

      doc.pipe(res);

      doc.font("Helvetica-Bold").fontSize(18).text(reportMeta.title, {
        align: "center",
      });

      doc.moveDown(0.3);
      doc.font("Helvetica").fontSize(10).text(
        "Generated from Disaster Relief Management System",
        { align: "center" }
      );

      drawAnalyticsSnapshotPdf(doc, snapshot, reportType);

      ensurePdfPageSpace(doc, 60);
      doc.moveDown(1);
      doc.font("Helvetica").fontSize(9).text(
        `Document generated on ${formatDateValue(new Date())}`,
        { align: "right" }
      );

      doc.end();
      return;
    }

    const items = await getInventoryItemsForReport(reportType);
    const summary = buildInventorySummary(items);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${reportMeta.filename}-${new Date()
        .toISOString()
        .slice(0, 10)}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 30,
      bufferPages: true,
    });

    doc.pipe(res);

    doc.font("Helvetica-Bold").fontSize(18).text(reportMeta.title, {
      align: "center",
    });

    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).text(
      "Generated from Disaster Relief Management System",
      { align: "center" }
    );

    drawPdfSectionTitle(doc, "Summary");
    drawPdfLabelValue(doc, "Report Type", formatTypeLabel(reportType));
    drawPdfLabelValue(doc, "Total Entries", String(summary.totalEntries));
    drawPdfLabelValue(doc, "Goods Entries", String(summary.goodsEntries));
    drawPdfLabelValue(doc, "Monetary Entries", String(summary.monetaryEntries));
    drawPdfLabelValue(doc, "Total Goods Quantity", String(summary.totalGoodsQuantity));
    drawPdfLabelValue(doc, "Total Monetary Amount", formatPeso(summary.totalMonetaryAmount));
    drawPdfLabelValue(doc, "Low Stock Goods", String(summary.lowStockGoods));
    drawPdfLabelValue(doc, "Expired Goods", String(summary.expiredGoods));
    drawPdfLabelValue(doc, "Expiring Soon Goods", String(summary.expiringSoonGoods));

    drawPdfSectionTitle(doc, "Inventory Items");

    const columns = [
      { label: "Name", key: "name", width: 135 },
      { label: "Type", key: "type", width: 55 },
      { label: "Category", key: "category", width: 75 },
      { label: "Qty", key: "quantity", width: 45, align: "right" },
      { label: "Unit", key: "unit", width: 45 },
      { label: "Amount", key: "amount", width: 85, align: "right" },
      { label: "Expiry", key: "expirationDate", width: 90 },
      { label: "Expiry Status", key: "expiryStatus", width: 85 },
      { label: "Source", key: "sourceType", width: 65 },
      { label: "Source Name", key: "sourceName", width: 95 },
      { label: "Added By", key: "addedBy", width: 75 },
    ];

    if (!items.length) {
      doc.font("Helvetica").fontSize(10).text("No inventory items available for this report.");
    } else {
      drawSimpleTableHeader(doc, columns);

      items.forEach((item) => {
        const amountText = item.type === "monetary" ? formatPeso(item.amount) : "-";

        drawSimpleTableRow(
          doc,
          columns,
          {
            name: normalizeString(item.name) || "-",
            type: formatTypeLabel(item.type),
            category: item.type === "goods" ? normalizeString(item.category) || "-" : "-",
            quantity: item.type === "goods" ? Number(item.quantity || 0) : "-",
            unit: item.type === "goods" ? normalizeString(item.unit) || "-" : "-",
            amount: amountText,
            expirationDate: item.type === "goods" ? formatDateOnly(item.expirationDate) : "-",
            expiryStatus:
              item.type === "goods" ? formatExpiryStatusLabel(item.expiryStatus) : "-",
            sourceType: formatTypeLabel(item.sourceType),
            sourceName: normalizeString(item.sourceName) || "-",
            addedBy: normalizeString(item.addedBy) || "-",
          },
          26
        );
      });
    }

    const itemsWithDescription = items.filter((item) => normalizeString(item.description));

    if (itemsWithDescription.length) {
      drawPdfSectionTitle(doc, "Descriptions");

      itemsWithDescription.forEach((item, index) => {
        ensurePdfPageSpace(doc, 50);
        doc
          .font("Helvetica-Bold")
          .fontSize(10)
          .text(`${index + 1}. ${normalizeString(item.name) || "Unnamed Item"}`);
        doc.font("Helvetica").fontSize(10).text(normalizeString(item.description));
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
    console.error("Export Inventory PDF Error:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
  }
};

// Add new inventory item
const addInventory = async (req, res) => {
  console.log("BODY:", req.body);
  console.log("FILES:", req.files);
  console.log("FILE:", req.file);

  try {
    const username = req.session?.username || "";

    const { errors, data } = validateInventoryData(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    let proofFiles = [];

    if (Array.isArray(req.files)) {
      proofFiles = req.files.map((file) => file.filename);
    } else if (req.file) {
      proofFiles = [req.file.filename];
    }

    const itemData = {
      type: data.type,
      name: data.name,
      description: data.description || "",
      sourceType: data.sourceType || "external",
      sourceName: data.sourceName || "",
      proofFiles,
      addedBy: username,
      isArchive: false,
    };

    if (data.type === "goods") {
      if (data.quantity === undefined || data.quantity <= 0) {
        return res.status(400).json({
          message: "Quantity must be greater than 0",
        });
      }

      if (!data.unit) {
        return res.status(400).json({
          message: "Unit is required",
        });
      }

      if (!data.category) {
        return res.status(400).json({
          message: "Category is required",
        });
      }

      itemData.category = data.category;
      itemData.quantity = data.quantity;
      itemData.unit = data.unit;
      itemData.expirationDate = data.expirationDate;
    }

    if (data.type === "monetary") {
      if (data.amount === undefined || data.amount <= 0) {
        return res.status(400).json({
          message: "Amount must be greater than 0",
        });
      }

      itemData.amount = data.amount;
    }

    console.log("FINAL ITEM DATA:", itemData);

    const item = await InventoryItem.create(itemData);

    try {
      await createLog(item, "create", username, "Inventory item created");
    } catch (logErr) {
      console.error("LOG ERROR:", logErr);
    }

    await notifyDonationCreated(item, username);
    await notifyInventoryRiskState(item, username);

    res.status(201).json(attachExpiryMeta(item));
  } catch (err) {
    console.error("Add Inventory Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get all active inventory items
const getInventory = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false }).sort({ createdAt: -1 });
    res.json(items.map((item) => attachExpiryMeta(item)));
  } catch (err) {
    console.error("Get Inventory Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Update inventory item
const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session?.username || "";

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    const finalType = req.body.type ? normalizeLower(req.body.type, item.type) : item.type;

    const mergedBody = {
      ...req.body,
      type: finalType,
    };

    const { errors, data } = validateInventoryData(mergedBody, true, item.type);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    if (req.body.name !== undefined) item.name = data.name;
    if (req.body.type !== undefined) item.type = data.type;
    if (req.body.description !== undefined) item.description = data.description;
    if (req.body.sourceType !== undefined) item.sourceType = data.sourceType;
    if (req.body.sourceName !== undefined) item.sourceName = data.sourceName;

    if (item.type === "goods") {
      if (req.body.category !== undefined) item.category = data.category;
      if (req.body.quantity !== undefined) item.quantity = data.quantity;
      if (req.body.unit !== undefined) item.unit = data.unit;
      if (req.body.expirationDate !== undefined) {
        item.expirationDate = data.expirationDate;
      }

      item.amount = undefined;
    }

    if (item.type === "monetary") {
      if (req.body.amount !== undefined) item.amount = data.amount;

      item.category = undefined;
      item.quantity = undefined;
      item.unit = undefined;
      item.expirationDate = undefined;
    }

    if (req.files && req.files.length > 0) {
      const newFiles = req.files.map((file) => file.filename);
      item.proofFiles = [...(item.proofFiles || []), ...newFiles];
    }

    await item.save();

    await createLog(item, "update", username, "Inventory item updated");

    await notifyInventoryRiskState(item, username);

    res.json(attachExpiryMeta(item));
  } catch (err) {
    console.error("Update Inventory Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Soft delete / archive
const deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session?.username || "";

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    item.isArchive = true;
    await item.save();

    await createLog(item, "archive", username, "Inventory item archived");

    res.json({
      message: "Inventory archived successfully",
      item: attachExpiryMeta(item),
    });
  } catch (err) {
    console.error("Delete Inventory Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Get archived inventory
const getArchivedInventory = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: true }).sort({ updatedAt: -1 });
    res.json(items.map((item) => attachExpiryMeta(item)));
  } catch (err) {
    console.error("Get Archived Inventory Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const unarchiveInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    item.isArchive = false;
    await item.save();

    res.json({
      message: "Inventory unarchived successfully",
      item: attachExpiryMeta(item),
    });
  } catch (err) {
    console.error("Unarchive Inventory Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const permanentDeleteInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    await InventoryItem.findByIdAndDelete(id);

    res.json({
      message: "Inventory permanently deleted successfully",
    });
  } catch (err) {
    console.error("Permanent Delete Inventory Error:", err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryCategories = async (req, res) => {
  try {
    const categories = await InventoryItem.distinct("category", {
      isArchive: false,
      type: "goods",
    });

    res.json(categories.sort());
  } catch (err) {
    console.error("Get Categories Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addInventory,
  getInventory,
  updateInventory,
  deleteInventory,
  getArchivedInventory,
  unarchiveInventory,
  permanentDeleteInventory,

  getInventorySummary,
  getInventoryCategoryStats,
  getInventorySourceStats,
  getInventoryRecentTrend,
  getInventoryHealth,
  getTopDonors,
  getDonationActivity,
  getInventoryAiInsights,

  getInventoryCategories,
  exportInventoryPdf,
};
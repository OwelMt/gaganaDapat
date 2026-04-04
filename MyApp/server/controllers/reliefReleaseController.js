const mongoose = require("mongoose");
const ReliefRequest = require("../models/ReliefRequest");
const ReliefRelease = require("../models/ReliefRelease");
const InventoryItem = require("../models/InventoryItem");
const InventoryLog = require("../models/InventoryLog");
const Audit = require("../models/Audit");
const FoodPackTemplate = require("../models/FoodPackTemplate");

const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeLower = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim().toLowerCase();
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const computePrioritySnapshotFromRequest = (request) => {
  const totals = request?.totals || {};

  const totalAffected =
    toNumber(totals.male) +
    toNumber(totals.female) +
    toNumber(totals.lgbtq) +
    toNumber(totals.pwd) +
    toNumber(totals.pregnant) +
    toNumber(totals.senior);

  const vulnerableCount =
    toNumber(totals.pwd) +
    toNumber(totals.pregnant) +
    toNumber(totals.senior);

  const requestedFoodPacks = toNumber(totals.requestedFoodPacks);

  const requestDate = request?.requestDate ? new Date(request.requestDate) : null;
  const now = new Date();
  const waitingMs = requestDate ? now.getTime() - requestDate.getTime() : 0;
  const waitingDays = Math.max(0, Math.floor(waitingMs / (1000 * 60 * 60 * 24)));

  const priorityScore =
    waitingDays * 5 +
    requestedFoodPacks * 0.2 +
    toNumber(totals.pwd) * 3 +
    toNumber(totals.pregnant) * 3 +
    toNumber(totals.senior) * 2 +
    toNumber(totals.families);

  return {
    totalAffected,
    vulnerableCount,
    priorityScore,
  };
};

const generateReleaseNo = async (session = null) => {
  const year = new Date().getFullYear();
  const prefix = `RL-${year}`;

  const latest = await ReliefRelease.findOne({
    releaseNo: { $regex: `^${prefix}-` },
  })
    .sort({ createdAt: -1 })
    .session(session);

  let nextNumber = 1;

  if (latest?.releaseNo) {
    const parts = latest.releaseNo.split("-");
    const lastSeq = Number(parts[2]);
    if (!Number.isNaN(lastSeq)) {
      nextNumber = lastSeq + 1;
    }
  }

  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
};

const validateReleaseItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return "At least one release item is required.";
  }

  for (const item of items) {
    const itemName = normalizeString(item.itemName);
    const category = normalizeLower(item.category);
    const quantityReleased = toNumber(item.quantityReleased);
    const unit = normalizeString(item.unit);

    if (!itemName) {
      return "Each release item must have an item name.";
    }

    if (!category) {
      return `Category is required for item "${itemName}".`;
    }

    if (quantityReleased <= 0) {
      return `Quantity released must be greater than 0 for item "${itemName}".`;
    }

    if (!unit) {
      return `Unit is required for item "${itemName}".`;
    }
  }

  return null;
};

const buildTemplateReleaseItems = async (
  foodPackTemplateId,
  foodPacksToRelease,
  session
) => {
  const template = await FoodPackTemplate.findById(foodPackTemplateId).session(
    session
  );

  if (!template || template.isArchived) {
    return {
      error: "Food pack template not found.",
    };
  }

  if (!template.isActive) {
    return {
      error: "Selected food pack template is inactive.",
    };
  }

  const packCount = toNumber(foodPacksToRelease);

  if (packCount <= 0) {
    return {
      error: "Food packs to release must be greater than 0.",
    };
  }

  const generatedItems = [];

  for (const item of template.items || []) {
    const inventoryDoc = await InventoryItem.findOne({
      _id: item.inventoryItemId,
      isArchive: false,
      type: "goods",
    }).session(session);

    if (!inventoryDoc) {
      return {
        error: `Inventory item not found for template item "${item.itemName}".`,
      };
    }

    generatedItems.push({
      inventoryItemId: inventoryDoc._id,
      itemName: normalizeString(item.itemName || inventoryDoc.name),
      category: normalizeLower(item.category || inventoryDoc.category),
      quantityReleased: Number(item.quantityPerPack || 0) * packCount,
      unit: normalizeString(item.unit || inventoryDoc.unit),
      remarks: normalizeString(
        item.remarks || `Generated from template: ${template.name}`
      ),
    });
  }

  const validationError = validateReleaseItems(generatedItems);
  if (validationError) {
    return { error: validationError };
  }

  return {
    template,
    items: generatedItems,
    foodPacksReleased: packCount,
  };
};

const inferManualFoodPacksReleased = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) return 0;

  const directPackItems = items.filter((item) => {
    const itemName = normalizeLower(item.itemName);
    const category = normalizeLower(item.category);
    const unit = normalizeLower(item.unit);

    const looksLikeFoodPackName =
      itemName.includes("food pack") ||
      itemName.includes("foodpack") ||
      itemName.includes("relief pack") ||
      itemName.includes("pack");

    const looksLikeFoodPackCategory =
      category.includes("food pack") ||
      category.includes("foodpack");

    const looksLikePackUnit = unit === "pack" || unit === "packs";

    return looksLikeFoodPackName || looksLikeFoodPackCategory || looksLikePackUnit;
  });

  if (directPackItems.length === 0) return 0;

  return directPackItems.reduce(
    (sum, item) => sum + toNumber(item.quantityReleased),
    0
  );
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

const deriveCurrentStage = (request) => {
  if (!request) return "preparation";

  if (request.status === "pending") return "pending_review";
  if (request.status === "rejected") return "rejected";
  if (request.status === "approved") return "approved_waiting_release";
  if (request.status === "partially_released") return "partially_released";
  if (request.status === "released") return "released_waiting_receipt";
  if (request.status === "received") return "completed";
  if (request.status === "cancelled") return "completed";

  return "pending_review";
};

const refreshRequestProgress = async (requestId, session = null) => {
  const request = await ReliefRequest.findById(requestId).session(session);
  if (!request || request.isArchived) return null;

  const releases = await ReliefRelease.find({
    reliefRequestId: request._id,
    isArchived: false,
  })
    .sort({ createdAt: -1 })
    .session(session);

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

  request.prioritySnapshot = computePrioritySnapshotFromRequest(request);

  if (!hasAnyRelease) {
    if (!["pending", "rejected", "cancelled", "received"].includes(request.status)) {
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
    const hasOutstandingReleased = releases.some(
      (release) => release.releaseStatus === "released"
    );
    const hasReceivedRelease = releases.some(
      (release) => release.releaseStatus === "received"
    );

    if (hasOutstandingReleased && hasReceivedRelease) {
      request.status = "partially_released";
      request.currentStage = "partially_released";
      request.receivedAt = null;
    } else if (hasOutstandingReleased) {
      request.status = "released";
      request.currentStage = "released_waiting_receipt";
      request.receivedAt = null;
    } else if (hasReceivedRelease) {
      request.status = "received";
      request.currentStage = "completed";
      if (!request.receivedAt) {
        request.receivedAt = new Date();
      }
    }
  }

  if (!request.currentStage) {
    request.currentStage = deriveCurrentStage(request);
  }

  await request.save({ session });
  return request;
};

/* GET REQUESTS READY FOR RELEASE */
const getApprovedRequestsForRelease = async (req, res) => {
  try {
    const requests = await ReliefRequest.find({
      status: { $in: ["approved", "partially_released"] },
      isArchived: false,
    }).sort({ createdAt: -1 });

    res.json(requests);
  } catch (err) {
    console.error("Get Approved Requests For Release Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* CREATE RELEASE AND DEDUCT INVENTORY */
const createReliefRelease = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const username = String(req.session?.username || req.session?.userId || "");
    const {
      reliefRequestId,
      items,
      remarks,
      foodPackTemplateId,
      releaseMode,
      isFinalRelease,
    } = req.body;

    const incomingFoodPackCount = Number(
      req.body.foodPacksToRelease ??
        req.body.foodPacksReleased ??
        req.body.foodPacks ??
        0
    );

    if (!reliefRequestId) {
      return res.status(400).json({ message: "Relief request ID is required." });
    }

    const requestedMode = normalizeLower(releaseMode);
    const isTemplateMode =
      requestedMode === "template" || !!normalizeString(foodPackTemplateId);

    let finalReleaseMode = "manual";
    let releaseItems = [];
    let foodPackTemplate = null;
    let releasedFoodPackCount = 0;

    if (isTemplateMode) {
      finalReleaseMode = "template";

      const built = await buildTemplateReleaseItems(
        foodPackTemplateId,
        incomingFoodPackCount,
        session
      );

      if (built.error) {
        return res.status(400).json({ message: built.error });
      }

      foodPackTemplate = built.template;
      releaseItems = built.items;
      releasedFoodPackCount = built.foodPacksReleased;
    } else {
      finalReleaseMode = "manual";

      releaseItems = Array.isArray(items)
        ? items.map((item) => ({
            inventoryItemId: item.inventoryItemId || null,
            itemName: normalizeString(item.itemName),
            category: normalizeLower(item.category),
            quantityReleased: toNumber(item.quantityReleased),
            unit: normalizeString(item.unit),
            remarks: normalizeString(item.remarks),
          }))
        : [];

      const validationError = validateReleaseItems(releaseItems);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      releasedFoodPackCount =
        toNumber(incomingFoodPackCount) > 0
          ? toNumber(incomingFoodPackCount)
          : inferManualFoodPacksReleased(releaseItems);
    }

    session.startTransaction();

    const reliefRequest = await ReliefRequest.findById(reliefRequestId).session(
      session
    );

    if (!reliefRequest || reliefRequest.isArchived) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Relief request not found." });
    }

    if (!["approved", "partially_released"].includes(reliefRequest.status)) {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Only approved or partially released requests can be released.",
      });
    }

    const requestedFoodPacks = toNumber(reliefRequest?.totals?.requestedFoodPacks);

    if (
      finalReleaseMode === "manual" &&
      requestedFoodPacks > 0 &&
      releasedFoodPackCount <= 0
    ) {
      await session.abortTransaction();
      return res.status(400).json({
        message:
          "Food Packs Equivalent is required for manual release. Enter how many requested food packs this release fulfills.",
      });
    }

    const preparedItems = [];

    for (const item of releaseItems) {
      let inventoryDoc = null;

      if (item.inventoryItemId) {
        inventoryDoc = await InventoryItem.findById(item.inventoryItemId).session(
          session
        );
      }

      if (!inventoryDoc) {
        inventoryDoc = await InventoryItem.findOne({
          isArchive: false,
          type: "goods",
          name: item.itemName,
          category: item.category,
          unit: item.unit,
        }).session(session);
      }

      if (!inventoryDoc) {
        await session.abortTransaction();
        return res.status(404).json({
          message: `Inventory item not found for "${item.itemName}".`,
        });
      }

      const availableQty = Number(inventoryDoc.quantity || 0);

      if (availableQty < item.quantityReleased) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Insufficient stock for "${item.itemName}". Available: ${availableQty}, requested release: ${item.quantityReleased}.`,
        });
      }

      preparedItems.push({
        inventoryDoc,
        inventoryItemId: inventoryDoc._id,
        itemName: inventoryDoc.name,
        category: normalizeLower(item.category || inventoryDoc.category),
        quantityReleased: Number(item.quantityReleased),
        unit: inventoryDoc.unit,
        remarks: item.remarks,
      });
    }

    for (const item of preparedItems) {
      item.inventoryDoc.quantity =
        Number(item.inventoryDoc.quantity || 0) - item.quantityReleased;

      await item.inventoryDoc.save({ session });

      await InventoryLog.create(
        [
          {
            inventoryItem: item.inventoryDoc._id,
            itemName: item.inventoryDoc.name,
            itemType: item.inventoryDoc.type,
            action: "release",
            quantity: item.quantityReleased,
            amount: undefined,
            performedBy: username,
            remarks: `Released for relief request ${reliefRequest.requestNo}`,
          },
        ],
        { session }
      );
    }

    const releaseNo = await generateReleaseNo(session);
    const releaseIsFinal = Boolean(isFinalRelease);

    const [reliefRelease] = await ReliefRelease.create(
      [
        {
          reliefRequestId: reliefRequest._id,
          barangayId: reliefRequest.barangayId,
          barangayName: reliefRequest.barangayName,
          releaseNo,
          releaseMode: finalReleaseMode,
          foodPackTemplateId: isTemplateMode ? foodPackTemplate._id : null,
          foodPackTemplateName: isTemplateMode ? foodPackTemplate.name : "",
          foodPacksReleased: releasedFoodPackCount,
          items: preparedItems.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            itemName: item.itemName,
            category: item.category,
            quantityReleased: item.quantityReleased,
            unit: item.unit,
            remarks: item.remarks,
          })),
          totalItemsReleased: preparedItems.reduce(
            (sum, item) => sum + Number(item.quantityReleased || 0),
            0
          ),
          releaseStatus: "released",
          releasedBy: username,
          releasedAt: new Date(),
          receivedAt: null,
          receivedBy: "",
          remarks: normalizeString(remarks),
          isFinalRelease: releaseIsFinal,
          releaseSummary: {
            totalLineItems: preparedItems.length,
            totalQuantityReleased: preparedItems.reduce(
              (sum, item) => sum + Number(item.quantityReleased || 0),
              0
            ),
          },
        },
      ],
      { session }
    );

    reliefRequest.releasedBy = username;
    reliefRequest.releasedAt = new Date();
    reliefRequest.releaseNotes = normalizeString(remarks);

    await reliefRequest.save({ session });

    const refreshedRequest = await refreshRequestProgress(reliefRequest._id, session);

    await Audit.create(
      [
        {
          barangayId: reliefRequest.barangayId,
          barangayName: reliefRequest.barangayName,
          category: "relief_release",
          peopleRange: isTemplateMode
            ? `Released ${releasedFoodPackCount} food packs`
            : releasedFoodPackCount > 0
              ? `Released ${releasedFoodPackCount} food packs manually`
              : `Released total quantity: ${preparedItems.reduce(
                  (sum, item) => sum + Number(item.quantityReleased || 0),
                  0
                )}`,
          status: refreshedRequest?.status || "partially_released",
          actionBy: "drrmo",
        },
      ],
      { session }
    );

    await session.commitTransaction();

    const updatedRequest = await ReliefRequest.findById(reliefRequest._id);
    const updatedRelease = await ReliefRelease.findById(reliefRelease._id);

    res.status(201).json({
      message: "Relief goods released successfully.",
      release: updatedRelease,
      request: updatedRequest,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Create Relief Release Error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

/* BARANGAY CONFIRMS RECEIPT OF A RELEASE */
const receiveReliefRelease = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const username = String(req.session?.username || req.session?.userId || "");
    const role = String(req.session?.role || "");
    const releaseId = req.params.id;

    if (!releaseId) {
      return res.status(400).json({ message: "Release ID is required." });
    }

    session.startTransaction();

    const reliefRelease = await ReliefRelease.findById(releaseId).session(session);

    if (!reliefRelease || reliefRelease.isArchived) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Relief release not found." });
    }

    if (reliefRelease.releaseStatus === "received") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "This release has already been received." });
    }

    if (reliefRelease.releaseStatus !== "released") {
      await session.abortTransaction();
      return res.status(400).json({
        message: "Only released items can be marked as received.",
      });
    }

    if (role === "barangay") {
      if (String(reliefRelease.barangayId) !== String(req.session.userId)) {
        await session.abortTransaction();
        return res.status(403).json({
          message: "You can only receive releases assigned to your barangay.",
        });
      }
    }

    reliefRelease.releaseStatus = "received";
    reliefRelease.receivedAt = new Date();
    reliefRelease.receivedBy = username;

    await reliefRelease.save({ session });

    const relatedRequest = await ReliefRequest.findById(
      reliefRelease.reliefRequestId
    ).session(session);

    let refreshedRequest = null;

    if (relatedRequest && !relatedRequest.isArchived) {
      refreshedRequest = await refreshRequestProgress(relatedRequest._id, session);

      await Audit.create(
        [
          {
            barangayId: relatedRequest.barangayId,
            barangayName: relatedRequest.barangayName,
            category: "relief_release",
            peopleRange:
              toNumber(reliefRelease.foodPacksReleased) > 0
                ? `Received ${toNumber(reliefRelease.foodPacksReleased)} food packs`
                : `Received release ${reliefRelease.releaseNo}`,
            status: refreshedRequest?.status || "partially_released",
            actionBy: "barangay",
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();

    const updatedRelease = await ReliefRelease.findById(reliefRelease._id);
    const updatedRequest = await ReliefRequest.findById(
      reliefRelease.reliefRequestId
    );

    res.json({
      message: "Relief goods received successfully.",
      release: updatedRelease,
      request: updatedRequest,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error("Receive Relief Release Error:", err);
    res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

/* GET RELEASES FOR A REQUEST */
const getReleasesByRequest = async (req, res) => {
  try {
    const releases = await ReliefRelease.find({
      reliefRequestId: req.params.reliefRequestId,
      isArchived: false,
    }).sort({ createdAt: -1 });

    res.json(releases);
  } catch (err) {
    console.error("Get Releases By Request Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* GET ALL RELEASES */
const getAllReliefReleases = async (req, res) => {
  try {
    const releases = await ReliefRelease.find({
      isArchived: false,
    }).sort({ createdAt: -1 });

    res.json(releases);
  } catch (err) {
    console.error("Get All Relief Releases Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getApprovedRequestsForRelease,
  createReliefRelease,
  receiveReliefRelease,
  getReleasesByRequest,
  getAllReliefReleases,
  refreshRequestProgress,
};
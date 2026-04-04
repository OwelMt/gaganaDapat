const mongoose = require("mongoose");
const Place = require("../models/EvacPlace.js");
const EHistory = require("../models/EvacHistory.js");

// -----------------------------
// HELPERS
// -----------------------------
const sanitizeText = (value) => {
  return String(value || "").replace(/<[^>]*>?/gm, "").trim();
};

const escapeRegex = (value) => {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const toNumber = (value, fallback = 0) => {
  if (value === "" || value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return Boolean(value);
};

const safeLower = (value) => String(value || "").toLowerCase().trim();

const normalizeBarangayKey = (value) => {
  return safeLower(value).replace(/[\s_-]+/g, "");
};

const buildBarangayLooseRegex = (value) => {
  const cleaned = normalizeBarangayKey(value);
  if (!cleaned) return null;

  const chars = cleaned.split("").map((char) => escapeRegex(char));
  return new RegExp(chars.join("[\\s_-]*"), "i");
};

const getSessionBarangayCandidates = (req) => {
  const candidates = [
    req.session?.barangayName,
    req.session?.username,
    req.session?.name,
  ]
    .map((item) => sanitizeText(item))
    .filter(Boolean);

  return [...new Set(candidates)];
};

const buildHistoryMeta = (
  req,
  place = null,
  fallbackBarangayId = null,
  fallbackBarangayName = ""
) => {
  return {
    barangayId: place?.barangayId || fallbackBarangayId || req.session?.userId || null,
    barangayName:
      sanitizeText(place?.barangayName) ||
      sanitizeText(fallbackBarangayName) ||
      sanitizeText(req.session?.barangayName || req.session?.username || req.session?.name),
    performedBy: sanitizeText(req.session?.username || req.session?.name || "unknown"),
    performedByRole: sanitizeText(req.session?.role || ""),
  };
};

const isBarangayOwnerOfPlace = (req, place) => {
  if (!place) return false;
  if (req.session?.role !== "barangay") return true;

  const userId = req.session?.userId;
  const candidates = getSessionBarangayCandidates(req);

  const idMatch =
    userId &&
    mongoose.Types.ObjectId.isValid(String(userId)) &&
    String(place.barangayId) === String(userId);

  const nameMatch = candidates.some((candidate) => {
    const exact =
      safeLower(place.barangayName) === safeLower(candidate);

    const normalized =
      normalizeBarangayKey(place.barangayName) === normalizeBarangayKey(candidate);

    return exact || normalized;
  });

  return Boolean(idMatch || nameMatch);
};

const buildRoleAwarePlaceFilter = (req) => {
  const role = req.session?.role;
  const userId = req.session?.userId;
  const barangayCandidates = getSessionBarangayCandidates(req);

  const filter = { isArchived: false };

  if (role === "barangay") {
    const ownConditions = [];

    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      ownConditions.push({ barangayId: userId });
    }

    barangayCandidates.forEach((candidate) => {
      if (!candidate) return;

      ownConditions.push({ barangayName: candidate });

      const looseRegex = buildBarangayLooseRegex(candidate);
      if (looseRegex) {
        ownConditions.push({ barangayName: looseRegex });
      }
    });

    if (ownConditions.length > 0) {
      filter.$or = ownConditions;
    }
  }

  return filter;
};

const buildRoleAwareHistoryFilter = (req) => {
  const role = req.session?.role;
  const userId = req.session?.userId;
  const barangayCandidates = getSessionBarangayCandidates(req);

  const filter = {};

  if (role === "barangay") {
    const ownConditions = [];

    if (userId && mongoose.Types.ObjectId.isValid(String(userId))) {
      ownConditions.push({ barangayId: userId });
    }

    barangayCandidates.forEach((candidate) => {
      if (!candidate) return;

      ownConditions.push({ barangayName: candidate });

      const looseRegex = buildBarangayLooseRegex(candidate);
      if (looseRegex) {
        ownConditions.push({ barangayName: looseRegex });
      }
    });

    if (ownConditions.length > 0) {
      filter.$or = ownConditions;
    }
  }

  return filter;
};

const applyPlaceQueryFilters = (baseFilter, req) => {
  const role = req.session?.role;

  const selectedBarangayId = sanitizeText(req.query?.barangayId);
  const selectedBarangayName = sanitizeText(req.query?.barangayName);
  const status = safeLower(req.query?.status);
  const search = sanitizeText(req.query?.search);

  const filter = { ...baseFilter };

  if (role !== "barangay") {
    if (selectedBarangayId && mongoose.Types.ObjectId.isValid(selectedBarangayId)) {
      filter.barangayId = selectedBarangayId;
    } else if (
      selectedBarangayName &&
      safeLower(selectedBarangayName) !== "all barangays"
    ) {
      filter.barangayName = selectedBarangayName;
    }
  }

  if (["available", "limited", "full"].includes(status)) {
    filter.capacityStatus = status;
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");

    const searchConditions = [
      { name: regex },
      { location: regex },
      { barangayName: regex },
      { remarks: regex },
    ];

    if (filter.$or && Array.isArray(filter.$or)) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: filter.$or });
      filter.$and.push({ $or: searchConditions });
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  return filter;
};

const applyHistoryQueryFilters = (baseFilter, req) => {
  const role = req.session?.role;

  const selectedBarangayId = sanitizeText(req.query?.barangayId);
  const selectedBarangayName = sanitizeText(req.query?.barangayName);
  const search = sanitizeText(req.query?.search);

  const filter = { ...baseFilter };

  if (role !== "barangay") {
    if (selectedBarangayId && mongoose.Types.ObjectId.isValid(selectedBarangayId)) {
      filter.barangayId = selectedBarangayId;
    } else if (
      selectedBarangayName &&
      safeLower(selectedBarangayName) !== "all barangays"
    ) {
      filter.barangayName = selectedBarangayName;
    }
  }

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");

    const searchConditions = [
      { placeName: regex },
      { details: regex },
      { barangayName: regex },
      { action: regex },
      { performedBy: regex },
    ];

    if (filter.$or && Array.isArray(filter.$or)) {
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: filter.$or });
      filter.$and.push({ $or: searchConditions });
      delete filter.$or;
    } else {
      filter.$or = searchConditions;
    }
  }

  return filter;
};

// -----------------------------
// CREATE PLACE
// -----------------------------
const createPlace = async (req, res) => {
  try {
    const {
      name,
      location,
      barangayId,
      barangayName,
      barangay,
      latitude,
      longitude,
      capacityIndividual,
      capacityFamily,
      bedCapacity,
      floorArea,
      femaleCR,
      maleCR,
      commonCR,
      potableWater,
      nonPotableWater,
      isPermanent,
      isCovidFacility,
      remarks,
    } = req.body;

    const sessionBarangayCandidates = getSessionBarangayCandidates(req);

    const finalBarangayId =
      barangayId || (req.session?.role === "barangay" ? req.session.userId : null);

    const finalBarangayName =
      sanitizeText(barangayName) ||
      sanitizeText(barangay) ||
      (req.session?.role === "barangay" ? sessionBarangayCandidates[0] || "" : "");

    if (
      !sanitizeText(name) ||
      !sanitizeText(location) ||
      !finalBarangayId ||
      !finalBarangayName ||
      latitude === undefined ||
      longitude === undefined ||
      capacityIndividual === undefined ||
      capacityFamily === undefined
    ) {
      return res.status(400).json({
        message:
          "Missing required fields: name, location, barangayId, barangayName, latitude, longitude, capacityIndividual, capacityFamily",
      });
    }

    const latNum = Number(latitude);
    const lngNum = Number(longitude);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return res.status(400).json({
        message: "Invalid coordinates",
      });
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({
        message: "Coordinates out of valid range",
      });
    }

    const newPlace = new Place({
      name: sanitizeText(name),
      location: sanitizeText(location),
      barangayId: finalBarangayId,
      barangayName: finalBarangayName,
      latitude: latNum,
      longitude: lngNum,
      capacityIndividual: toNumber(capacityIndividual, 0),
      capacityFamily: toNumber(capacityFamily, 0),
      bedCapacity: toNumber(bedCapacity, 0),
      floorArea: toNumber(floorArea, 0),
      femaleCR: toBoolean(femaleCR),
      maleCR: toBoolean(maleCR),
      commonCR: toBoolean(commonCR),
      potableWater: toBoolean(potableWater),
      nonPotableWater: toBoolean(nonPotableWater),
      isPermanent: toBoolean(isPermanent),
      isCovidFacility: toBoolean(isCovidFacility),
      remarks: sanitizeText(remarks),
      capacityStatus: "available",
    });

    await newPlace.save();

    await EHistory.create({
      action: "ADD",
      placeName: newPlace.name,
      details: `Added ${newPlace.name} in ${newPlace.barangayName} with individual capacity ${newPlace.capacityIndividual}`,
      ...buildHistoryMeta(req, newPlace, finalBarangayId, finalBarangayName),
    });

    return res.status(201).json({
      message: "Place created successfully",
      place: newPlace,
    });
  } catch (error) {
    console.error("Create Place Error:", error);

    if (error.code === 11000) {
      return res.status(400).json({
        message: "An active evacuation place with the same name already exists in this barangay",
      });
    }

    return res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------
// GET ALL PLACES
// -----------------------------
const getPlaces = async (req, res) => {
  try {
    const baseFilter = buildRoleAwarePlaceFilter(req);
    const finalFilter = applyPlaceQueryFilters(baseFilter, req);

    const places = await Place.find(finalFilter).sort({
      barangayName: 1,
      name: 1,
      createdAt: -1,
    });

    return res.json(places);
  } catch (err) {
    console.error("Get Places Error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------
// GET HISTORY
// -----------------------------
const getHistory = async (req, res) => {
  try {
    const baseFilter = buildRoleAwareHistoryFilter(req);
    const finalFilter = applyHistoryQueryFilters(baseFilter, req);

    const logs = await EHistory.find(finalFilter).sort({ createdAt: -1 });
    return res.json(logs);
  } catch (err) {
    console.error("Get History Error:", err);
    return res.status(500).json({ message: "Failed to load history" });
  }
};

// -----------------------------
// UPDATE PLACE
// -----------------------------
const updatePlace = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Place.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Place not found" });
    }

    if (!isBarangayOwnerOfPlace(req, existing)) {
      return res.status(403).json({
        message: "You are not allowed to update this evacuation area",
      });
    }

    const {
      name,
      location,
      barangayId,
      barangayName,
      barangay,
      latitude,
      longitude,
      capacityIndividual,
      capacityFamily,
      bedCapacity,
      floorArea,
      femaleCR,
      maleCR,
      commonCR,
      potableWater,
      nonPotableWater,
      isPermanent,
      isCovidFacility,
      remarks,
    } = req.body;

    const finalBarangayName = sanitizeText(barangayName) || sanitizeText(barangay);

    existing.name = sanitizeText(name || existing.name);
    existing.location = sanitizeText(location || existing.location);

    if (barangayId && req.session?.role !== "barangay") {
      existing.barangayId = barangayId;
    }

    if (finalBarangayName && req.session?.role !== "barangay") {
      existing.barangayName = finalBarangayName;
    }

    if (latitude !== undefined) {
      const latNum = Number(latitude);
      if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({ message: "Invalid latitude" });
      }
      existing.latitude = latNum;
    }

    if (longitude !== undefined) {
      const lngNum = Number(longitude);
      if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({ message: "Invalid longitude" });
      }
      existing.longitude = lngNum;
    }

    if (capacityIndividual !== undefined) {
      existing.capacityIndividual = toNumber(capacityIndividual, 0);
    }

    if (capacityFamily !== undefined) {
      existing.capacityFamily = toNumber(capacityFamily, 0);
    }

    if (bedCapacity !== undefined) {
      existing.bedCapacity = toNumber(bedCapacity, 0);
    }

    if (floorArea !== undefined) {
      existing.floorArea = toNumber(floorArea, 0);
    }

    if (femaleCR !== undefined) existing.femaleCR = toBoolean(femaleCR);
    if (maleCR !== undefined) existing.maleCR = toBoolean(maleCR);
    if (commonCR !== undefined) existing.commonCR = toBoolean(commonCR);
    if (potableWater !== undefined) existing.potableWater = toBoolean(potableWater);
    if (nonPotableWater !== undefined) existing.nonPotableWater = toBoolean(nonPotableWater);
    if (isPermanent !== undefined) existing.isPermanent = toBoolean(isPermanent);
    if (isCovidFacility !== undefined) existing.isCovidFacility = toBoolean(isCovidFacility);
    if (remarks !== undefined) existing.remarks = sanitizeText(remarks);

    await existing.save();

    await EHistory.create({
      action: "UPDATE",
      placeName: existing.name,
      details: `Updated details for ${existing.name}`,
      ...buildHistoryMeta(req, existing),
    });

    return res.json({
      message: "Place updated successfully",
      place: existing,
    });
  } catch (err) {
    console.error("Update Place Error:", err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: "An active evacuation place with the same name already exists in this barangay",
      });
    }

    return res.status(500).json({ message: "Update failed" });
  }
};

// -----------------------------
// UPDATE CAPACITY STATUS
// -----------------------------
const updateCapacityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { capacityStatus } = req.body;

    if (!["available", "limited", "full"].includes(capacityStatus)) {
      return res.status(400).json({ message: "Invalid capacity status" });
    }

    const existing = await Place.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Place not found" });
    }

    if (!isBarangayOwnerOfPlace(req, existing)) {
      return res.status(403).json({
        message: "You are not allowed to update this evacuation area",
      });
    }

    existing.capacityStatus = capacityStatus;
    await existing.save();

    await EHistory.create({
      action: "STATUS_UPDATE",
      placeName: existing.name,
      details: `Status changed to ${capacityStatus}`,
      ...buildHistoryMeta(req, existing),
    });

    return res.json(existing);
  } catch (err) {
    console.error("Update Capacity Status Error:", err);
    return res.status(500).json({ message: "Update failed" });
  }
};

// -----------------------------
// DELETE / ARCHIVE PLACE
// -----------------------------
const deletePlace = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await Place.findById(id);
    if (!existing) {
      return res.status(404).json({ message: "Place not found" });
    }

    if (!isBarangayOwnerOfPlace(req, existing)) {
      return res.status(403).json({
        message: "You are not allowed to archive this evacuation area",
      });
    }

    existing.isArchived = true;
    existing.archivedAt = new Date();
    await existing.save();

    await EHistory.create({
      action: "DELETE",
      placeName: existing.name,
      details: "Place archived",
      ...buildHistoryMeta(req, existing),
    });

    return res.json({ message: "Place archived successfully" });
  } catch (err) {
    console.error("Delete Place Error:", err);
    return res.status(500).json({ message: "Delete failed" });
  }
};

// -----------------------------
// ANALYTICS SUMMARY
// -----------------------------
const getAnalyticsSummary = async (req, res) => {
  try {
    const baseFilter = buildRoleAwarePlaceFilter(req);
    const finalFilter = applyPlaceQueryFilters(baseFilter, req);

    const places = await Place.find(finalFilter);

    const totalPlaces = places.length;

    const statusCounts = places.reduce(
      (acc, p) => {
        const status = p.capacityStatus || "available";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      },
      { available: 0, limited: 0, full: 0 }
    );

    const totalIndividualCapacity = places.reduce(
      (sum, p) => sum + (p.capacityIndividual || 0),
      0
    );

    const totalFamilyCapacity = places.reduce(
      (sum, p) => sum + (p.capacityFamily || 0),
      0
    );

    const totalBedCapacity = places.reduce(
      (sum, p) => sum + (p.bedCapacity || 0),
      0
    );

    const permanentCount = places.filter((p) => p.isPermanent).length;
    const covidFacilities = places.filter((p) => p.isCovidFacility).length;

    const barangayBreakdownMap = places.reduce((acc, place) => {
      const key = sanitizeText(place.barangayName) || "Unassigned";

      if (!acc[key]) {
        acc[key] = {
          barangayName: key,
          totalPlaces: 0,
          available: 0,
          limited: 0,
          full: 0,
          totalIndividualCapacity: 0,
          totalFamilyCapacity: 0,
          totalBedCapacity: 0,
        };
      }

      const status = place.capacityStatus || "available";

      acc[key].totalPlaces += 1;
      acc[key][status] = (acc[key][status] || 0) + 1;
      acc[key].totalIndividualCapacity += place.capacityIndividual || 0;
      acc[key].totalFamilyCapacity += place.capacityFamily || 0;
      acc[key].totalBedCapacity += place.bedCapacity || 0;

      return acc;
    }, {});

    const barangayBreakdown = Object.values(barangayBreakdownMap).sort((a, b) =>
      a.barangayName.localeCompare(b.barangayName)
    );

    const criticalBarangays = barangayBreakdown.filter(
      (item) => item.full > 0 || item.available === 0
    );

    return res.json({
      totalPlaces,
      statusCounts,
      totalIndividualCapacity,
      totalFamilyCapacity,
      totalBedCapacity,
      permanentCount,
      covidFacilities,
      barangayBreakdown,
      criticalBarangays,
    });
  } catch (error) {
    console.error("Get Analytics Summary Error:", error);
    return res.status(500).json({ message: "Failed to fetch analytics" });
  }
};

module.exports = {
  createPlace,
  getPlaces,
  getHistory,
  updatePlace,
  updateCapacityStatus,
  deletePlace,
  getAnalyticsSummary,
};
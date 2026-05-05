const Notification = require("../models/Notification");

const normalizeString = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).trim();
};

const normalizeLower = (value) => normalizeString(value).toLowerCase();

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const moduleLabels = {
  relief: "Relief",
  inventory: "Inventory",
  donation: "Donation",
  announcement: "Announcement",
  incident: "Incident",
  evacuation: "Evacuation",
  guidelines: "Guidelines",
  account: "Account",
  analytics: "Analytics",
  system: "System",
};

const VALID_MODULES = new Set(Object.keys(moduleLabels));
const VALID_ACTOR_ROLES = new Set(["admin", "drrmo", "barangay", "system"]);

const roleLabels = {
  admin: "Admin",
  drrmo: "DRRMO",
  barangay: "Barangay",
  system: "System",
  all: "All",
};

const formatModuleLabel = (moduleName) =>
  moduleLabels[normalizeLower(moduleName)] || normalizeString(moduleName) || "System";

const formatRoleLabel = (roleName) =>
  roleLabels[normalizeLower(roleName)] || normalizeString(roleName) || "System";

const normalizeModuleValue = (moduleName) => {
  const value = normalizeLower(moduleName);
  return VALID_MODULES.has(value) ? value : "system";
};

const normalizeActorRoleValue = (roleName) => {
  const value = normalizeLower(roleName);
  return VALID_ACTOR_ROLES.has(value) ? value : "system";
};

const buildSearchText = (event) =>
  [
    event.title,
    event.message,
    event.module,
    event.moduleLabel,
    event.type,
    event.actorName,
    event.actorRole,
    event.actorRoleLabel,
    event.barangayName,
    event.requestNo,
    event.disaster,
    event.referenceModel,
    event.targetLabel,
  ]
    .map((value) => normalizeString(value))
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const mapNotificationToAuditEvent = (notification) => {
  const metadata =
    notification && typeof notification.metadata === "object" && notification.metadata !== null
      ? notification.metadata
      : {};

  const actorName =
    normalizeString(notification.senderName) ||
    normalizeString(metadata.username) ||
    normalizeString(metadata.adminUsername) ||
    "System";

  const actorRole = normalizeActorRoleValue(
    normalizeLower(notification.senderRole) ||
      normalizeLower(metadata.senderRole) ||
      "system"
  );

  const module = normalizeModuleValue(notification.module);

  const barangayName =
    normalizeString(metadata.barangayName) ||
    normalizeString(notification.recipientBarangayName) ||
    normalizeString(metadata.recipientBarangayName) ||
    "";

  const requestNo =
    normalizeString(metadata.requestNo) ||
    normalizeString(metadata.referenceNo) ||
    "";

  const disaster =
    normalizeString(metadata.disaster) ||
    normalizeString(metadata.hazard) ||
    "";

  const targetLabel =
    barangayName ||
    requestNo ||
    normalizeString(notification.referenceModel) ||
    normalizeString(notification.recipientRole) ||
    "";

  return {
    _id: String(notification._id),
    source: "notification",
    module,
    moduleLabel: formatModuleLabel(module),
    type: normalizeLower(notification.type) || "general",
    priority: normalizeLower(notification.priority) || "normal",
    title: normalizeString(notification.title) || "System activity",
    message: normalizeString(notification.message) || "No message available.",
    actorName,
    actorRole,
    actorRoleLabel: formatRoleLabel(actorRole),
    recipientRole: normalizeLower(notification.recipientRole) || "unknown",
    recipientRoleLabel: formatRoleLabel(notification.recipientRole),
    barangayName,
    requestNo,
    disaster,
    referenceId: notification.referenceId || null,
    referenceModel: normalizeString(notification.referenceModel),
    targetLabel,
    createdAt: notification.createdAt || notification.updatedAt || null,
  };
};

const buildSummary = (events = []) => {
  const modules = new Set();
  const actors = new Set();
  let todayCount = 0;
  let highPriorityCount = 0;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  events.forEach((event) => {
    if (event.module) modules.add(event.module);
    if (event.actorName) actors.add(`${event.actorRole}:${event.actorName}`);
    if (["high", "critical"].includes(event.priority)) highPriorityCount += 1;

    const eventDate = event.createdAt ? new Date(event.createdAt) : null;
    if (eventDate && !Number.isNaN(eventDate.getTime()) && eventDate >= todayStart) {
      todayCount += 1;
    }
  });

  return {
    total: events.length,
    today: todayCount,
    modules: modules.size,
    actors: actors.size,
    highPriority: highPriorityCount,
  };
};

const getAuditLogs = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    if (normalizeLower(req.session.role) !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }

    const moduleFilter = normalizeLower(req.query.module);
    const actorRoleFilter = normalizeLower(req.query.actorRole);
    const searchQuery = normalizeLower(req.query.search);
    const days = Math.max(0, toNumber(req.query.days));
    const limit = Math.min(500, Math.max(25, toNumber(req.query.limit) || 250));

    const notificationQuery = {};

    if (moduleFilter && moduleFilter !== "all") {
      notificationQuery.module = moduleFilter;
    }

    if (days > 0) {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      notificationQuery.createdAt = { $gte: since };
    }

    const notifications = await Notification.find(notificationQuery).sort({ createdAt: -1 }).limit(limit);

    const normalizedEvents = notifications.map(mapNotificationToAuditEvent).sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

    const filterBaseEvents = searchQuery
      ? normalizedEvents.filter((event) => buildSearchText(event).includes(searchQuery))
      : normalizedEvents;

    let events = filterBaseEvents;

    if (moduleFilter && moduleFilter !== "all") {
      events = events.filter((event) => event.module === moduleFilter);
    }

    if (actorRoleFilter && actorRoleFilter !== "all") {
      events = events.filter((event) => event.actorRole === actorRoleFilter);
    }

    const availableModules = Array.from(
      new Set(filterBaseEvents.map((event) => event.module).filter(Boolean))
    ).sort();

    const availableActorRoles = Array.from(
      new Set(filterBaseEvents.map((event) => event.actorRole).filter(Boolean))
    ).sort();

    res.json({
      events,
      filters: {
        modules: availableModules.map((moduleName) => ({
          value: moduleName,
          label: formatModuleLabel(moduleName),
        })),
        actorRoles: availableActorRoles.map((roleName) => ({
          value: roleName,
          label: formatRoleLabel(roleName),
        })),
      },
      summary: buildSummary(events),
    });
  } catch (err) {
    console.error("Audit log fetch error:", err);
    res.status(500).json({ message: "Failed to load audit logs" });
  }
};

module.exports = { getAuditLogs };

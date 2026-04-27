const PublicSite = require("../models/PublicSite");

const LIMITS = {
  announcements: 5,
  services: 6,
  hotlines: 4,
  tips: 6,
};

const DEFAULT_PAYLOAD = {
  key: "main",
  hero: {
    title: "Jaen MDRRMO Public Information Portal",
    subtitle:
      "Access weather conditions, public advisories, emergency contacts, evacuation information, and local DRRM updates in one place.",
    primaryCtaLabel: "View Weather",
    secondaryCtaLabel: "Emergency Contacts",
  },
  alert: {
    enabled: true,
    level: "Advisory",
    text: "Monitor official weather updates and keep emergency contact lines accessible.",
  },
  announcements: [
    {
      title: "Preparedness Reminder",
      body: "Keep go-bags ready, secure important documents, and monitor MDRRMO advisories during unstable weather.",
      tag: "Public Advisory",
    },
    {
      title: "Evacuation Readiness",
      body: "Barangays should review local evacuation areas and identify households needing priority assistance.",
      tag: "Operations",
    },
  ],
  services: [
    {
      title: "Evacuation Areas",
      desc: "View mapped evacuation areas and their current status.",
      icon: "evacuation",
    },
    {
      title: "Announcements",
      desc: "See official advisories and updates from the MDRRMO.",
      icon: "announcement",
    },
    {
      title: "Relief Services",
      desc: "Understand local relief support and emergency response information.",
      icon: "relief",
    },
    {
      title: "Citizen Access",
      desc: "Login for authorized system access and operational modules.",
      icon: "account",
    },
  ],
  hotlines: [
    {
      label: "Emergency Hotline",
      number: "0999-000-0000",
      type: "call",
    },
    {
      label: "SMS Hotline",
      number: "0999-000-0001",
      type: "sms",
    },
    {
      label: "Email",
      number: "jaenmdrrmo@example.com",
      type: "email",
    },
    {
      label: "Facebook Page",
      number: "https://facebook.com/",
      type: "link",
    },
  ],
  tips: [
    { text: "Prepare a go-bag for each household member." },
    { text: "Keep flashlights, batteries, and water ready." },
    { text: "Save emergency numbers on every family phone." },
    { text: "Follow official advisories and avoid rumor-based posts." },
  ],
  office: {
    name: "Jaen MDRRMO",
    address: "Jaen, Nueva Ecija",
    hours: "Office hours may vary during emergencies.",
    email: "jaenmdrrmo@example.com",
    facebook: "https://facebook.com/",
  },
  incidentFeedMode: "all",
};

const trimString = (value, maxLength, fallback = "") => {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
};

const normalizeArray = (value) => {
  return Array.isArray(value) ? value : [];
};

const sanitizeAnnouncement = (item) => {
  return {
    title: trimString(item?.title, 80),
    body: trimString(item?.body, 180),
    tag: trimString(item?.tag, 32, "Update") || "Update",
  };
};

const sanitizeService = (item) => {
  const allowedIcons = ["evacuation", "announcement", "relief", "account"];
  const icon = trimString(item?.icon, 30, "announcement");

  return {
    title: trimString(item?.title, 50),
    desc: trimString(item?.desc, 120),
    icon: allowedIcons.includes(icon) ? icon : "announcement",
  };
};

const sanitizeHotline = (item) => {
  const allowedTypes = ["call", "sms", "email", "link"];
  const type = trimString(item?.type, 20, "call");

  return {
    label: trimString(item?.label, 40),
    number: trimString(item?.number, 120),
    type: allowedTypes.includes(type) ? type : "call",
  };
};

const sanitizeTip = (item) => {
  return {
    text: trimString(item?.text, 120),
  };
};

const sanitizePayload = (body = {}) => {
  const announcements = normalizeArray(body.announcements)
    .slice(0, LIMITS.announcements)
    .map(sanitizeAnnouncement)
    .filter((item) => item.title && item.body);

  const services = normalizeArray(body.services)
    .slice(0, LIMITS.services)
    .map(sanitizeService)
    .filter((item) => item.title && item.desc);

  const hotlines = normalizeArray(body.hotlines)
    .slice(0, LIMITS.hotlines)
    .map(sanitizeHotline)
    .filter((item) => item.label && item.number);

  const tips = normalizeArray(body.tips)
    .slice(0, LIMITS.tips)
    .map(sanitizeTip)
    .filter((item) => item.text);

  const incidentFeedModeRaw =
    trimString(body?.incidentFeedMode, 20, DEFAULT_PAYLOAD.incidentFeedMode) ||
    DEFAULT_PAYLOAD.incidentFeedMode;
  const incidentFeedMode =
    incidentFeedModeRaw === "resolved-only" ? "resolved-only" : "all";

  return {
    hero: {
      title:
        trimString(body?.hero?.title, 90, DEFAULT_PAYLOAD.hero.title) ||
        DEFAULT_PAYLOAD.hero.title,
      subtitle:
        trimString(body?.hero?.subtitle, 180, DEFAULT_PAYLOAD.hero.subtitle) ||
        DEFAULT_PAYLOAD.hero.subtitle,
      primaryCtaLabel:
        trimString(
          body?.hero?.primaryCtaLabel,
          24,
          DEFAULT_PAYLOAD.hero.primaryCtaLabel
        ) || DEFAULT_PAYLOAD.hero.primaryCtaLabel,
      secondaryCtaLabel:
        trimString(
          body?.hero?.secondaryCtaLabel,
          24,
          DEFAULT_PAYLOAD.hero.secondaryCtaLabel
        ) || DEFAULT_PAYLOAD.hero.secondaryCtaLabel,
    },

    alert: {
      enabled: !!body?.alert?.enabled,
      level:
        trimString(body?.alert?.level, 20, DEFAULT_PAYLOAD.alert.level) ||
        DEFAULT_PAYLOAD.alert.level,
      text:
        trimString(body?.alert?.text, 180, DEFAULT_PAYLOAD.alert.text) ||
        DEFAULT_PAYLOAD.alert.text,
    },

    announcements:
      announcements.length > 0 ? announcements : DEFAULT_PAYLOAD.announcements,

    services: services.length > 0 ? services : DEFAULT_PAYLOAD.services,

    hotlines: hotlines.length > 0 ? hotlines : DEFAULT_PAYLOAD.hotlines,

    tips: tips.length > 0 ? tips : DEFAULT_PAYLOAD.tips,

    office: {
      name:
        trimString(body?.office?.name, 50, DEFAULT_PAYLOAD.office.name) ||
        DEFAULT_PAYLOAD.office.name,
      address:
        trimString(body?.office?.address, 120, DEFAULT_PAYLOAD.office.address) ||
        DEFAULT_PAYLOAD.office.address,
      hours:
        trimString(body?.office?.hours, 120, DEFAULT_PAYLOAD.office.hours) ||
        DEFAULT_PAYLOAD.office.hours,
      email:
        trimString(body?.office?.email, 80, DEFAULT_PAYLOAD.office.email) ||
        DEFAULT_PAYLOAD.office.email,
      facebook:
        trimString(body?.office?.facebook, 120, DEFAULT_PAYLOAD.office.facebook) ||
        DEFAULT_PAYLOAD.office.facebook,
    },
    incidentFeedMode,
  };
};

const getActor = (req) => {
  return (
    req.session?.username ||
    req.session?.name ||
    req.session?.role ||
    "system"
  );
};

const getOrCreatePublicSite = async () => {
  let site = await PublicSite.findOne({ key: "main" });

  if (!site) {
    site = await PublicSite.create(DEFAULT_PAYLOAD);
  }

  return site;
};

const getPublicSite = async (req, res) => {
  try {
    const site = await getOrCreatePublicSite();
    return res.status(200).json(site);
  } catch (error) {
    console.error("getPublicSite error:", error);
    return res.status(500).json({
      message: "Failed to load public site content.",
    });
  }
};

const updatePublicSite = async (req, res) => {
  try {
    const payload = sanitizePayload(req.body || {});
    const updatedBy = getActor(req);

    const updated = await PublicSite.findOneAndUpdate(
      { key: "main" },
      {
        $set: {
          hero: payload.hero,
          alert: payload.alert,
          announcements: payload.announcements,
          services: payload.services,
          hotlines: payload.hotlines,
          tips: payload.tips,
          office: payload.office,
          incidentFeedMode: payload.incidentFeedMode,
          updatedBy,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      message: "Public site updated successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("updatePublicSite error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Invalid public site content.",
        error: error.message,
      });
    }

    return res.status(500).json({
      message: "Failed to update public site content.",
    });
  }
};

const updateIncidentFeedMode = async (req, res) => {
  try {
    const mode = req.body?.mode === "resolved-only" ? "resolved-only" : "all";
    const updatedBy = getActor(req);

    const updated = await PublicSite.findOneAndUpdate(
      { key: "main" },
      {
        $set: {
          incidentFeedMode: mode,
          updatedBy,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      message:
        mode === "resolved-only"
          ? "Landing page now shows resolved incidents only."
          : "Landing page now shows all incidents.",
      data: updated,
    });
  } catch (error) {
    console.error("updateIncidentFeedMode error:", error);
    return res.status(500).json({
      message: "Failed to update incident feed mode.",
    });
  }
};

const resetPublicSite = async (req, res) => {
  try {
    const updatedBy = getActor(req);

    const resetDoc = await PublicSite.findOneAndUpdate(
      { key: "main" },
      {
        $set: {
          ...DEFAULT_PAYLOAD,
          updatedBy,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      message: "Public site reset successfully.",
      data: resetDoc,
    });
  } catch (error) {
    console.error("resetPublicSite error:", error);
    return res.status(500).json({
      message: "Failed to reset public site content.",
    });
  }
};

module.exports = {
  getPublicSite,
  updatePublicSite,
  resetPublicSite,
  updateIncidentFeedMode,
};

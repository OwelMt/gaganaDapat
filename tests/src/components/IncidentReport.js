import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  GeoJSON,
  Polygon,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import {
  FaBell,
  FaCalendarDays,
  FaCircleCheck,
  FaClock,
  FaClockRotateLeft,
  FaEye,
  FaEyeSlash,
  FaFilePdf,
  FaFilter,
  FaImage,
  FaLocationDot,
  FaMagnifyingGlass,
  FaMapLocationDot,
  FaPhone,
  FaShieldHalved,
  FaTrashCan,
  FaTriangleExclamation,
  FaUser,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import incidentImage from "../assets/images/incident-icon.png";
import jaenGeoJSON from "./data/jaen.json";
import DashboardShell from "./layout/DashboardShell";
import "../components/css/IncidentReporting.css";

const BASE_URL =
  process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

const TOAST_LIMIT = 3;
const TOAST_DURATION = 10000;
const BOUNDS_BUFFER = 0.01;

const JAEN_CENTER = {
  lat: 15.3382,
  lng: 120.9056,
};

const incidentIcon = new L.Icon({
  iconUrl: incidentImage,
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const jaenStyle = {
  color: "#08661f",
  weight: 2,
  opacity: 0.95,
  fill: false,
  dashArray: "6, 6",
  lineCap: "round",
};

const maskStyle = {
  stroke: false,
  fillColor: "#1f2937",
  fillOpacity: 0.28,
  interactive: false,
};

const safeLower = (value) => String(value ?? "").toLowerCase().trim();

const formatNumber = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0";
  return new Intl.NumberFormat().format(num);
};

const formatDateTime = (value) => {
  if (!value) return "Unknown date";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const formatTimestamp = (ts) => {
  if (!ts) return "Unknown date";

  const numericTs = Number(ts);
  const date = new Date(
    numericTs > 1_000_000_000_000 ? numericTs : numericTs * 1000
  );

  if (Number.isNaN(date.getTime())) return "Unknown date";

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
};

const getIncidentStatusLabel = (status) => {
  if (!status || status === "reported") return "Reported";
  if (status === "onProcess") return "On Process";
  if (status === "resolved") return "Resolved";
  return status;
};

const getIncidentStatusTone = (status) => {
  if (!status || status === "reported") return "warning";
  if (status === "onProcess") return "info";
  if (status === "resolved") return "success";
  return "neutral";
};

const getVerificationTone = (status) => {
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "warning";
};

const getSeverityTone = (level) => {
  const normalized = safeLower(level);

  if (normalized.includes("critical")) return "danger";
  if (normalized.includes("high")) return "danger";
  if (normalized.includes("medium")) return "warning";
  if (normalized.includes("low")) return "success";

  return "neutral";
};

const getSeverityLabel = (level) => {
  const normalized = safeLower(level);
  if (normalized.includes("critical")) return "critical";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium")) return "medium";
  if (normalized.includes("low")) return "low";
  return "unknown";
};

const truncateLocation = (location, max = 62) => {
  const raw = String(location || "").trim();
  if (!raw) return "Unknown location";
  if (raw.length <= max) return raw;
  return `${raw.slice(0, max).trim()}...`;
};

const getIncidentTypeAccent = (type) => {
  const normalized = safeLower(type);
  if (normalized.includes("flood")) return "flood";
  if (normalized.includes("fire")) return "fire";
  if (normalized.includes("earthquake") || normalized.includes("quake")) return "quake";
  return "general";
};

const getStatusIcon = (status) => {
  if (status === "resolved") return <FaCircleCheck aria-hidden="true" />;
  if (status === "onProcess") return <FaClockRotateLeft aria-hidden="true" />;
  return <FaBell aria-hidden="true" />;
};

function extractOuterRings(geojson) {
  const rings = [];
  if (!geojson) return rings;

  const features =
    geojson.type === "FeatureCollection"
      ? geojson.features
      : geojson.type === "Feature"
      ? [geojson]
      : [];

  features.forEach((feature) => {
    const geometry = feature?.geometry;
    if (!geometry) return;

    if (geometry.type === "Polygon") {
      if (geometry.coordinates?.[0]) {
        rings.push(geometry.coordinates[0]);
      }
    }

    if (geometry.type === "MultiPolygon") {
      geometry.coordinates?.forEach((polygon) => {
        if (polygon?.[0]) {
          rings.push(polygon[0]);
        }
      });
    }
  });

  return rings;
}

function buildInverseMaskGeoJSON(geojson) {
  const outerWorldRing = [
    [-180, 90],
    [180, 90],
    [180, -90],
    [-180, -90],
    [-180, 90],
  ];

  const holes = extractOuterRings(geojson);

  return {
    type: "Feature",
    properties: { name: "Jaen Outside Mask" },
    geometry: {
      type: "Polygon",
      coordinates: [outerWorldRing, ...holes],
    },
  };
}

function isPointInsideJaen(lat, lng) {
  try {
    const clicked = turfPoint([lng, lat]);

    if (jaenGeoJSON.type === "FeatureCollection") {
      return jaenGeoJSON.features.some((feature) =>
        booleanPointInPolygon(clicked, feature)
      );
    }

    if (jaenGeoJSON.type === "Feature") {
      return booleanPointInPolygon(clicked, jaenGeoJSON);
    }

    return false;
  } catch (error) {
    console.error("Jaen polygon check failed:", error);
    return false;
  }
}

function SummaryCard({ tone, icon, label, value, sub, urgent = false }) {
  return (
    <div className={`incident-summary-card ${tone} ${urgent ? "urgent" : ""}`}>
      <div className="incident-summary-card-top">
        <span className="incident-summary-icon" aria-hidden="true">
          {icon}
        </span>

        {urgent && (
          <span className="incident-summary-alert-dot" title="Needs attention">
            !
          </span>
        )}
      </div>

      <div className="incident-summary-label">{label}</div>
      <div className="incident-summary-value">{value}</div>
      <div className="incident-summary-sub">{sub}</div>
    </div>
  );
}

export default function IncidentReport() {
  const navigate = useNavigate();
  const detailsRef = useRef(null);
  const notificationTimersRef = useRef({});
  const thresholdSignatureRef = useRef("");

  const [incidents, setIncidents] = useState([]);
  const [barangayBounds, setBarangayBounds] = useState([]);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [statusMap, setStatusMap] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loadingPage, setLoadingPage] = useState(true);

  const [landingIncidentMode, setLandingIncidentMode] = useState("all");
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [incidentStatusFilter, setIncidentStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (!storedRole) navigate("/");
  }, [navigate]);

  useEffect(() => {
    const timers = notificationTimersRef.current;

    return () => {
      Object.values(timers).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const pushNotification = useCallback((message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setNotifications((prev) =>
      [{ id, message, type }, ...prev].slice(0, TOAST_LIMIT)
    );

    if (notificationTimersRef.current[id]) {
      clearTimeout(notificationTimersRef.current[id]);
    }

    notificationTimersRef.current[id] = setTimeout(() => {
      setNotifications((prev) =>
        prev.filter((notification) => notification.id !== id)
      );
      delete notificationTimersRef.current[id];
    }, TOAST_DURATION);
  }, []);

  const removeNotification = useCallback((id) => {
    if (notificationTimersRef.current[id]) {
      clearTimeout(notificationTimersRef.current[id]);
      delete notificationTimersRef.current[id];
    }

    setNotifications((prev) =>
      prev.filter((notification) => notification.id !== id)
    );
  }, []);

  const getNotificationIcon = useCallback((type) => {
    if (type === "success") return "✓";
    if (type === "error" || type === "warning") return "!";
    return "i";
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/incident/getIncidents`, {
        withCredentials: true,
      });

      const payload = Array.isArray(res.data) ? res.data : [];
      setIncidents(payload);
    } catch (error) {
      console.error("Fetch incidents error:", error);
      pushNotification("Failed to load incident reports.", "error");
    } finally {
      setLoadingPage(false);
    }
  }, [pushNotification]);

  const fetchBarangayBounds = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/barangays/bounds`, {
        withCredentials: true,
      });

      const payload = Array.isArray(res.data) ? res.data : [];
      setBarangayBounds(payload);
    } catch (error) {
      console.error("Fetch barangay bounds error:", error);
      setBarangayBounds([]);
    }
  }, []);

  const fetchLandingIncidentMode = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/public-site`, {
        withCredentials: true,
      });
      const source = res?.data?.data || res?.data || {};
      const nextMode =
        source?.incidentFeedMode === "resolved-only" ? "resolved-only" : "all";
      setLandingIncidentMode(nextMode);
    } catch (error) {
      console.error("Fetch incident landing mode error:", error);
      setLandingIncidentMode("all");
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    fetchBarangayBounds();
    fetchLandingIncidentMode();
  }, [fetchIncidents, fetchBarangayBounds, fetchLandingIncidentMode]);

  const jaenBounds = useMemo(() => {
    if (!jaenGeoJSON) return null;
    return L.geoJSON(jaenGeoJSON).getBounds();
  }, []);

  const allowedBounds = useMemo(() => {
    if (!jaenBounds) return null;

    return L.latLngBounds([
      [
        jaenBounds.getSouthWest().lat - BOUNDS_BUFFER,
        jaenBounds.getSouthWest().lng - BOUNDS_BUFFER,
      ],
      [
        jaenBounds.getNorthEast().lat + BOUNDS_BUFFER,
        jaenBounds.getNorthEast().lng + BOUNDS_BUFFER,
      ],
    ]);
  }, [jaenBounds]);

  const maskGeoJSON = useMemo(() => buildInverseMaskGeoJSON(jaenGeoJSON), []);

  const selectedIncident = useMemo(() => {
    return (
      incidents.find((item) => String(item._id) === String(selectedIncidentId)) ||
      null
    );
  }, [incidents, selectedIncidentId]);

  const summary = useMemo(() => {
    const total = incidents.length;

    const reported = incidents.filter(
      (item) => !item.status || item.status === "reported" || item.status === ""
    ).length;

    const onProcess = incidents.filter(
      (item) => item.status === "onProcess"
    ).length;

    const resolved = incidents.filter(
      (item) => item.status === "resolved"
    ).length;

    const highSeverity = incidents.filter((item) =>
      safeLower(item.level).includes("high")
    ).length;

    const aiPending = incidents.filter(
      (item) => (item.verification?.status || "pending") === "pending"
    ).length;

    return {
      total,
      reported,
      onProcess,
      resolved,
      highSeverity,
      aiPending,
    };
  }, [incidents]);

  useEffect(() => {
    const signature = [
      summary.highSeverity > 0 ? "high-severity" : "",
      summary.reported >= 4 ? "many-reported" : "",
      summary.aiPending >= 3 ? "ai-backlog" : "",
    ]
      .filter(Boolean)
      .join("|");

    if (!signature || thresholdSignatureRef.current === signature) return;

    thresholdSignatureRef.current = signature;

    if (summary.highSeverity > 0) {
      pushNotification(
        `${formatNumber(summary.highSeverity)} high-severity incident(s) detected.`,
        "error"
      );
    }

    if (summary.reported >= 4) {
      pushNotification(
        `${formatNumber(summary.reported)} incidents are still waiting for active handling.`,
        "warning"
      );
    }

    if (summary.aiPending >= 3) {
      pushNotification(
        `${formatNumber(summary.aiPending)} incidents still need AI/manual review.`,
        "warning"
      );
    }
  }, [pushNotification, summary]);

  const getAIReviewSummary = useCallback((verification = {}) => {
    const status = verification.status || "pending";
    const confidence = Number(verification.confidence ?? 0);

    const matchedLabels = Array.isArray(verification.matchedLabels)
      ? verification.matchedLabels
      : [];

    const labels = Array.isArray(verification.labels) ? verification.labels : [];
    const metadata = verification.metadata || {};
    const reasoning = String(verification.reasoning || "").trim();

    const allLabels = [...matchedLabels, ...labels].filter(Boolean);
    const labelsText = allLabels.length
      ? allLabels.join(", ")
      : "No detected labels";

    let inferredVerdict = "Needs manual review.";

    if (status === "approved") {
      inferredVerdict = "Approved by AI.";
    } else if (status === "rejected") {
      inferredVerdict = "Rejected by AI.";
    } else if (confidence >= 70 && allLabels.length > 0) {
      inferredVerdict = "Likely valid incident.";
    } else if (confidence > 0 && allLabels.length > 0) {
      inferredVerdict = "Partially matched incident indicators.";
    }

    return {
      status,
      confidence,
      score: Number(verification.score ?? confidence ?? 0),
      verdict: inferredVerdict,
      matchText:
        matchedLabels.length > 0
          ? matchedLabels.join(", ")
          : "No detected labels",
      metaText: [
        metadata.hasGPS ? "GPS present" : "no GPS",
        metadata.isRecent ? "recent" : "not recent",
        metadata.isWithinArea ? "within Jaen" : "outside Jaen / unknown area",
      ].join(" • "),
      reasoning:
        reasoning ||
        "No AI reasoning data was returned yet. Manual review is still required.",
      labelsText,
      metadata,
    };
  }, []);

  const filteredIncidents = useMemo(() => {
    const term = safeLower(search);

    let list = [...incidents];

    if (term) {
      list = list.filter((item) => {
        const ai = getAIReviewSummary(item.verification);

        return (
          safeLower(item.type).includes(term) ||
          safeLower(item.level).includes(term) ||
          safeLower(item.location).includes(term) ||
          safeLower(item.description).includes(term) ||
          safeLower(item.usernames).includes(term) ||
          safeLower(item.phone).includes(term) ||
          safeLower(ai.status).includes(term) ||
          safeLower(ai.verdict).includes(term)
        );
      });
    }

    if (incidentStatusFilter !== "all") {
      list = list.filter((item) => {
        const status = item.status || "reported";
        return status === incidentStatusFilter;
      });
    }

        if (verificationFilter !== "all") {
      list = list.filter((item) => {
        const status = item.verification?.status || "pending";
        return status === verificationFilter;
      });
    }

    list.sort((a, b) => {
      const priority = {
        reported: 1,
        onProcess: 2,
        resolved: 3,
      };

      const aStatus = a.status || "reported";
      const bStatus = b.status || "reported";
      const aPriority = priority[aStatus] || 99;
      const bPriority = priority[bStatus] || 99;

      if (aPriority !== bPriority) return aPriority - bPriority;

      const aSeverity = safeLower(a.level);
      const bSeverity = safeLower(b.level);
      const severityOrder = { high: 1, medium: 2, low: 3 };

      if ((severityOrder[aSeverity] || 99) !== (severityOrder[bSeverity] || 99)) {
        return (severityOrder[aSeverity] || 99) - (severityOrder[bSeverity] || 99);
      }

      const aDate = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const bDate = new Date(b.createdAt || b.updatedAt || 0).getTime();

      return bDate - aDate;
    });

    return list;
  }, [
    getAIReviewSummary,
    incidentStatusFilter,
    incidents,
    search,
    verificationFilter,
  ]);

  useEffect(() => {
    if (!filteredIncidents.length) {
      setSelectedIncidentId(null);
      return;
    }

    if (!selectedIncidentId) {
      setSelectedIncidentId(filteredIncidents[0]._id);
      return;
    }

    const stillVisible = filteredIncidents.some(
      (item) => String(item._id) === String(selectedIncidentId)
    );

    if (!stillVisible) {
      setSelectedIncidentId(filteredIncidents[0]._id);
    }
  }, [filteredIncidents, selectedIncidentId]);

  const handleQueueSelect = useCallback((incidentId) => {
    setSelectedIncidentId(incidentId);

    setTimeout(() => {
      detailsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  }, []);

  const handleStatusChange = async (incidentId, nextStatus) => {
    try {
      const incident = incidents.find((item) => item._id === incidentId);

      await axios.put(
        `${BASE_URL}/incident/updateStatus/${incidentId}`,
        { status: nextStatus },
        { withCredentials: true }
      );

      await axios.post(
        `${BASE_URL}/history/registerHistory`,
        {
          action: "STATUS_UPDATE",
          placeName: incident?.location,
          details: incident?.description,
        },
        { withCredentials: true }
      );

      setIncidents((prev) =>
        prev.map((item) =>
          item._id === incidentId ? { ...item, status: nextStatus } : item
        )
      );

      setStatusMap((prev) => ({ ...prev, [incidentId]: nextStatus }));

      pushNotification(
        `Incident status updated to ${getIncidentStatusLabel(nextStatus)}.`,
        "success"
      );
    } catch (error) {
      console.error("Update status error:", error);
      pushNotification("Failed to update incident status.", "error");
    }
  };

  const handleVerifyOverride = async (incidentId, nextStatus) => {
    try {
      const normalizedStatus = safeLower(nextStatus);
      const rootBaseUrl = String(BASE_URL || "").replace(/\/+$/, "");
      const primaryUrl = `${rootBaseUrl}/incident/updateVerification/${incidentId}`;
      const fallbackUrl = `${rootBaseUrl.replace(/\/api$/i, "")}/api/incident/updateVerification/${incidentId}`;

      let res = null;
      try {
        res = await axios.put(
          primaryUrl,
          { status: normalizedStatus },
          { withCredentials: true }
        );
      } catch (primaryError) {
        const primaryStatus = primaryError?.response?.status;

        if (primaryStatus === 404) {
          res = await axios.put(
            fallbackUrl,
            { status: normalizedStatus },
            { withCredentials: true }
          );
        } else {
          throw primaryError;
        }
      }

      const updatedIncident = res?.data?.incident;

      if (updatedIncident) {
        setIncidents((prev) =>
          prev.map((item) => (item._id === incidentId ? updatedIncident : item))
        );
      } else {
        setIncidents((prev) =>
          prev.map((item) =>
            item._id === incidentId
              ? {
                  ...item,
                  verification: {
                    ...(item.verification || {}),
                    status: normalizedStatus,
                  },
                }
              : item
          )
        );
      }

      pushNotification(
        `AI verification marked as ${normalizedStatus}.`,
        normalizedStatus === "approved" ? "success" : "warning"
      );
    } catch (error) {
      console.error("Update AI verification error:", error);
      pushNotification(
        error?.response?.data?.message || "Failed to update AI verification.",
        "error"
      );
    }
  };

  const handleReverify = async (incidentId) => {
    try {
      const res = await axios.put(
        `${BASE_URL}/incident/reverify/${incidentId}`,
        {},
        { withCredentials: true }
      );

      const updatedIncident =
        res?.data?.incident ||
        res?.data?.data ||
        res?.data ||
        null;

      if (updatedIncident && updatedIncident._id) {
        setIncidents((prev) =>
          prev.map((item) => (item._id === incidentId ? updatedIncident : item))
        );
      } else {
        await fetchIncidents();
      }

      pushNotification("AI re-verification completed.", "info");
    } catch (error) {
      console.error("Reverify error:", error);
      pushNotification(
        error?.response?.data?.message || "Failed to re-verify incident image.",
        "error"
      );
    }
  };

  const handleDelete = async (incidentId) => {
    const incident = incidents.find((item) => item._id === incidentId);

    try {
      await axios.post(
        `${BASE_URL}/history/registerHistory`,
        {
          action: "DELETE",
          placeName: incident?.location,
          details: incident?.description,
        },
        { withCredentials: true }
      );

      await axios.delete(`${BASE_URL}/incident/delete/${incidentId}`, {
        withCredentials: true,
      });

      setIncidents((prev) => prev.filter((item) => item._id !== incidentId));

      setStatusMap((prev) => {
        const copy = { ...prev };
        delete copy[incidentId];
        return copy;
      });

      pushNotification("Incident report deleted.", "warning");
    } catch (error) {
      console.error("Delete incident error:", error);
      pushNotification("Failed to delete incident report.", "error");
    }
  };

  const handleExportIncidentPdf = useCallback(
    (incidentId) => {
      if (!incidentId) {
        pushNotification("Select an incident first before exporting PDF.", "warning");
        return;
      }

      const exportUrl = `${BASE_URL}/incident/export-pdf/${incidentId}`;
      window.open(exportUrl, "_blank", "noopener,noreferrer");
    },
    [pushNotification]
  );

  const handleLandingIncidentModeToggle = useCallback(async () => {
    const nextMode =
      landingIncidentMode === "resolved-only" ? "all" : "resolved-only";

    try {
      await axios.put(
        `${BASE_URL}/api/public-site/incident-feed-mode`,
        { mode: nextMode },
        { withCredentials: true }
      );

      setLandingIncidentMode(nextMode);
      pushNotification(
        nextMode === "resolved-only"
          ? "Landing page now shows resolved incidents only."
          : "Landing page now shows all incidents.",
        "success"
      );
    } catch (error) {
      console.error("Incident landing mode toggle error:", error);
      pushNotification(
        error?.response?.data?.message ||
          "Failed to update landing incident visibility mode.",
        "error"
      );
    }
  }, [landingIncidentMode, pushNotification]);

  const renderNotifications = () => {
    if (!notifications.length) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
      <div className="notification-stack" role="status" aria-live="polite">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            type="button"
            className={`notification-toast ${notification.type}`}
            onClick={() => removeNotification(notification.id)}
          >
            <span className="notification-icon" aria-hidden="true">
              {getNotificationIcon(notification.type)}
            </span>
            <span className="notification-text">{notification.message}</span>
          </button>
        ))}
      </div>,
      document.body
    );
  };

  const renderImageModal = () => {
    if (!imagePreviewOpen || !selectedIncident?.image?.fileUrl) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
      <div
        className="incident-image-modal"
        onClick={() => setImagePreviewOpen(false)}
      >
        <div
          className="incident-image-modal-card"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="incident-image-close"
            onClick={() => setImagePreviewOpen(false)}
          >
            ×
          </button>

          <img
            src={selectedIncident.image.fileUrl}
            alt="incident full preview"
          />
        </div>
      </div>,
      document.body
    );
  };

  if (loadingPage) {
    return (
      <DashboardShell variant="drrmo">
        <div className="incident-dashboard-page">
          <div className="incident-loading-state">
            <div className="incident-loading-card">
              <span className="incident-loading-spinner" aria-hidden="true" />
              <div>
                <strong>Loading incident reporting</strong>
                <span>Preparing queue, map, and detail review panel.</span>
              </div>
            </div>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const activeIncident = selectedIncident || filteredIncidents[0] || null;
  const activeAI = getAIReviewSummary(activeIncident?.verification || {});
  const activeStatus =
    statusMap[activeIncident?._id] || activeIncident?.status || "reported";

  return (
    <DashboardShell variant="drrmo">
      <div className="incident-dashboard-page">
        {renderNotifications()}
        {renderImageModal()}

        <section className="incident-dashboard-header">
          <div className="incident-dashboard-heading">
            <div className="eyebrow">
              <FaMapLocationDot aria-hidden="true" />
              Operations
            </div>
            <h1>Incident Reporting</h1>
            <p>
              Monitor reports, review mapped incidents, validate AI output, and
              keep details lower and clearer for DRRMO operations.
            </p>
          </div>

          <div className="incident-dashboard-actions">
            <button
              type="button"
              className={`ghost-btn public-toggle-header-btn bulk-public-btn ${
                landingIncidentMode === "resolved-only" ? "is-on" : "is-off"
              }`}
              onClick={handleLandingIncidentModeToggle}
              title="Toggle incident visibility mode for public landing page"
            >
              {landingIncidentMode === "resolved-only" ? (
                <FaEyeSlash aria-hidden="true" />
              ) : (
                <FaEye aria-hidden="true" />
              )}
              {landingIncidentMode === "resolved-only"
                ? "Resolved On Landing"
                : "All Incidents On Landing"}
            </button>
          </div>
        </section>

        <section className="incident-summary-grid">
          <SummaryCard
            tone="accent"
            icon={<FaBell />}
            label="Total Incidents"
            value={formatNumber(summary.total)}
            sub="All reports currently loaded"
          />

          <SummaryCard
            tone="warning"
            icon={<FaClock />}
            label="Reported"
            value={formatNumber(summary.reported)}
            sub="Waiting for active handling"
            urgent={summary.reported >= 4}
          />

          <SummaryCard
            tone="muted"
            icon={<FaClockRotateLeft />}
            label="On Process"
            value={formatNumber(summary.onProcess)}
            sub="Currently being worked on"
          />

          <SummaryCard
            tone="success"
            icon={<FaCircleCheck />}
            label="Resolved"
            value={formatNumber(summary.resolved)}
            sub="Closed incident reports"
          />

          <SummaryCard
            tone="danger"
            icon={<FaTriangleExclamation />}
            label="High Severity"
            value={formatNumber(summary.highSeverity)}
            sub="Needs visible priority"
            urgent={summary.highSeverity > 0}
          />

          <SummaryCard
            tone="warning"
            icon={<FaShieldHalved />}
            label="AI Pending"
            value={formatNumber(summary.aiPending)}
            sub="Manual AI review required"
            urgent={summary.aiPending >= 3}
          />
        </section>

        <section className="incident-top-filters">
          <label className="incident-filter-field">
            <span>
              <FaMagnifyingGlass aria-hidden="true" />
              Search
            </span>
            <input
              type="text"
              placeholder="Search incident type, location, user, phone, or AI state"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>

          <label className="incident-filter-field">
            <span>
              <FaFilter aria-hidden="true" />
              Status
            </span>
            <select
              value={incidentStatusFilter}
              onChange={(e) => setIncidentStatusFilter(e.target.value)}
            >
              <option value="all">All status</option>
              <option value="reported">Reported</option>
              <option value="onProcess">On Process</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>

                    <label className="incident-filter-field">
            <span>
              <FaWandMagicSparkles aria-hidden="true" />
              AI Review
            </span>
            <select
              value={verificationFilter}
              onChange={(e) => setVerificationFilter(e.target.value)}
            >
              <option value="all">All review states</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
        </section>

        <section className="incident-main-layout">
          <aside className="incident-left-panel">
            <div className="panel-head">
              <div>
                <h2>Incident Queue</h2>
                <p>Priority queue. Click a report to jump to details.</p>
                <div className="incident-queue-legend">
                  <span className="mini-status warning">reported</span>
                  <span className="mini-status info">on process</span>
                  <span className="mini-status success">resolved</span>
                </div>
              </div>
            </div>

            <div className="incident-queue-list">
              {filteredIncidents.length ? (
                filteredIncidents.map((incident) => {
                  const ai = getAIReviewSummary(incident.verification);

                  return (
                    <button
                      key={incident._id}
                      type="button"
                      className={`incident-queue-card ${
                        String(selectedIncidentId) === String(incident._id)
                          ? "selected"
                          : ""
                      } status-${incident.status || "reported"}`}
                      onClick={() => handleQueueSelect(incident._id)}
                    >
                      <div className="incident-queue-top">
                        <div>
                          <div className="incident-queue-title">
                            {incident.type || "Incident"}
                          </div>

                          <div className="incident-queue-subtitle">
                            <FaCalendarDays aria-hidden="true" />
                            {formatDateTime(
                              incident.createdAt ||
                                incident.updatedAt ||
                                incident.date ||
                                incident.reportedAt
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="incident-queue-foot">
                        <span
                          className={`mini-status ${getVerificationTone(ai.status)}`}
                        >
                          AI {ai.status || "pending"} • {getSeverityLabel(incident.level)}
                        </span>
                        <span className="mini-neutral-badge">
                          {truncateLocation(incident.location)}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="empty-state-card">
                  <div>
                    <span className="empty-state-icon">
                      <FaBell />
                    </span>
                    <strong>No incidents found</strong>
                    <span>Adjust filters or wait for new reports to appear.</span>
                  </div>
                </div>
              )}
            </div>
          </aside>

          <section className="incident-map-panel">
            <div className="panel-head">
              <div>
                <h2>Incident Map</h2>
                <p>
                  Same Jaen-bounded map behavior as your evacuation module, with
                  the boundary visible.
                </p>
              </div>
            </div>

            <div className="incident-map-stage">
              <MapContainer
                center={[JAEN_CENTER.lat, JAEN_CENTER.lng]}
                zoom={14}
                minZoom={13}
                maxZoom={18}
                maxBounds={allowedBounds || undefined}
                maxBoundsViscosity={1.0}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="© OpenStreetMap contributors"
                />

                <GeoJSON data={maskGeoJSON} style={maskStyle} />
                <GeoJSON data={jaenGeoJSON} style={jaenStyle} />

                {Array.isArray(barangayBounds) &&
                  barangayBounds.map((item, index) => {
                    const geo = item.features?.[0]?.geometry || item.geometry;
                    if (!geo) return null;

                    const positions =
                      geo.type === "Polygon"
                        ? geo.coordinates[0].map(([lng, lat]) => [lat, lng])
                        : geo.type === "MultiPolygon"
                        ? geo.coordinates[0][0].map(([lng, lat]) => [lat, lng])
                        : [];

                    if (!positions.length) return null;

                    return (
                      <Polygon
                        key={item._id || index}
                        positions={positions}
                        pathOptions={{
                          color: "#3388ff",
                          weight: 2,
                          fillOpacity: 0.12,
                        }}
                      />
                    );
                  })}

                {filteredIncidents.map((incident) => {
                  const lat = Number(incident.latitude);
                  const lng = Number(incident.longitude);

                  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
                  if (!isPointInsideJaen(lat, lng)) return null;

                  return (
                    <Marker
                      key={incident._id}
                      position={[lat, lng]}
                      icon={incidentIcon}
                      eventHandlers={{
                        click: () => handleQueueSelect(incident._id),
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                        <div className="incident-tooltip">
                          <strong>
                            {String(incident.type || "Incident").toUpperCase()}
                          </strong>
                          <br />
                          Status: {getIncidentStatusLabel(incident.status)}
                          <br />
                          Severity: {incident.level || "-"}
                          <br />
                          {incident.location || "-"}
                        </div>
                      </Tooltip>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          </section>
        </section>

        <section
          className={`incident-details-panel incident-review-panel ${
            activeIncident
              ? `incident-review-${getIncidentTypeAccent(activeIncident.type)}`
              : ""
          }`}
          ref={detailsRef}
        >
          <div className="incident-details-body incident-unified-body">
            {activeIncident ? (
              <div className="incident-unified-card">
                <div
                  className={`incident-unified-hero ${getIncidentTypeAccent(
                    activeIncident.type
                  )}`}
                >
                  <div className="incident-review-icon-wrap">
                    {safeLower(activeIncident.type).includes("fire") ? (
                      <FaTriangleExclamation aria-hidden="true" />
                    ) : safeLower(activeIncident.type).includes("earthquake") ? (
                      <FaMapLocationDot aria-hidden="true" />
                    ) : (
                      <FaBell aria-hidden="true" />
                    )}
                  </div>

                  <div className="incident-review-title-wrap">
                    <div className="incident-details-topline">
                      <span
                        className={`mini-status ${getIncidentStatusTone(
                          activeIncident.status || "reported"
                        )}`}
                      >
                        {getIncidentStatusLabel(activeIncident.status)}
                      </span>

                      <span
                        className={`mini-status ${getSeverityTone(
                          activeIncident.level
                        )}`}
                      >
                        {activeIncident.level || "unknown"}
                      </span>

                      <span
                        className={`mini-status ${getVerificationTone(
                          activeAI.status
                        )}`}
                      >
                        AI {activeAI.status}
                      </span>
                    </div>

                    <h3>{activeIncident.type || "Incident"}</h3>

                    <div className="incident-hero-location">
                      <FaLocationDot aria-hidden="true" />
                      <span>{activeIncident.location || "Unknown location"}</span>
                    </div>

                    <div className="incident-hero-actions">
                      <div className="top-response-actions" aria-label="Response status">
                        {["reported", "onProcess", "resolved"].map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={`top-response-btn ${status} ${
                              activeStatus === status ? "active" : ""
                            }`}
                            onClick={() =>
                              handleStatusChange(activeIncident._id, status)
                            }
                          >
                            {status === "reported" && <FaClock aria-hidden="true" />}
                            {status === "onProcess" && (
                              <FaClockRotateLeft aria-hidden="true" />
                            )}
                            {status === "resolved" && (
                              <FaCircleCheck aria-hidden="true" />
                            )}
                            {getIncidentStatusLabel(status)}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="ghost-btn export-incident-btn"
                        onClick={() => handleExportIncidentPdf(activeIncident?._id)}
                        disabled={!activeIncident?._id}
                      >
                        <FaFilePdf aria-hidden="true" />
                        Export PDF
                      </button>
                    </div>
                  </div>
                </div>

                <div className="incident-two-column-layout">
                  <div className="incident-left-column">
                    <div className="incident-context-row">
                      <div className="context-card">
                        <span className="context-icon">
                          <FaUser aria-hidden="true" />
                        </span>
                        <div>
                          <span>Reporter</span>
                          <strong>{activeIncident.usernames || "-"}</strong>
                        </div>
                      </div>

                      <div className="context-card">
                        <span className="context-icon">
                          <FaPhone aria-hidden="true" />
                        </span>
                        <div>
                          <span>Phone</span>
                          <strong>{activeIncident.phone || "-"}</strong>
                        </div>
                      </div>

                      <div className="context-card">
                        <span className="context-icon">
                          <FaCalendarDays aria-hidden="true" />
                        </span>
                        <div>
                          <span>Reported</span>
                          <strong>
                            {formatDateTime(
                              activeIncident.createdAt ||
                                activeIncident.updatedAt ||
                                activeIncident.date ||
                                activeIncident.reportedAt
                            )}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div className="incident-review-section incident-location-card">
                      <div className="incident-review-section-head compact">
                        <div>
                          <h3>Location Details</h3>
                          <p>Coordinates and written address.</p>
                        </div>
                      </div>

                      <div className="incident-metadata-grid review-meta-grid">
                        <div className="incident-meta-item wide">
                          <span>
                            <FaLocationDot aria-hidden="true" />
                            Address
                          </span>
                          <strong>{activeIncident.location || "-"}</strong>
                        </div>

                        <div className="incident-meta-item">
                          <span>Latitude</span>
                          <strong>{activeIncident.latitude || "-"}</strong>
                        </div>

                        <div className="incident-meta-item">
                          <span>Longitude</span>
                          <strong>{activeIncident.longitude || "-"}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="incident-review-section incident-evidence-card">
                      <div className="incident-review-section-head compact">
                        <div>
                          <h3>Image Evidence</h3>
                        </div>
                      </div>

                      {activeIncident.image?.fileUrl ? (
                        <>
                          <button
                            type="button"
                            className="incident-image-preview-button"
                            onClick={() => setImagePreviewOpen(true)}
                          >
                            <img
                              src={activeIncident.image.fileUrl}
                              alt="incident preview"
                              className="incident-preview-image"
                            />
                          </button>

                          <div className="incident-image-preview-hint">
                            <FaImage aria-hidden="true" />
                            Click image to review larger
                          </div>
                        </>
                      ) : (
                        <div className="incident-no-image-card">
                          <span className="empty-state-icon">
                            <FaImage aria-hidden="true" />
                          </span>
                          <strong>No image uploaded</strong>
                          <span>This report has no attached image evidence.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="incident-right-column">
                    <div className="incident-review-section incident-ai-review-section">
                    <div className="incident-review-section-head">
                      <div>
                        <h3>AI Verification Review</h3>
                      </div>

                      <span
                        className={`mini-status ${getVerificationTone(
                          activeAI.status
                        )}`}
                      >
                        {activeAI.status}
                      </span>
                    </div>

                    <div className="incident-ai-summary-card">
                      <div className="incident-ai-verdict-row">
                        <strong>{activeAI.verdict}</strong>
                        <span className="ai-score-pill">
                          Score {activeAI.score}
                        </span>
                      </div>

                      <div className="incident-ai-detail-grid">
                        <div>
                          <span>Match</span>
                          <strong>{activeAI.matchText}</strong>
                        </div>

                        <div>
                          <span>Labels</span>
                          <strong>{activeAI.labelsText}</strong>
                        </div>

                        <div>
                          <span>Metadata</span>
                          <strong>{activeAI.metaText}</strong>
                        </div>
                      </div>

                      <p className="incident-ai-reasoning">
                        {activeAI.reasoning}
                      </p>
                    </div>

                    <div className="status-action-grid ai-action-grid">
                      <button
                        type="button"
                        className={`status-action-btn available ${
                          activeAI.status === "approved" ? "active" : ""
                        }`}
                        onClick={() =>
                          handleVerifyOverride(activeIncident._id, "approved")
                        }
                      >
                        <FaCircleCheck aria-hidden="true" />
                        Approve AI
                      </button>

                      <button
                        type="button"
                        className={`status-action-btn full ${
                          activeAI.status === "rejected" ? "active" : ""
                        }`}
                        onClick={() =>
                          handleVerifyOverride(activeIncident._id, "rejected")
                        }
                      >
                        <FaTriangleExclamation aria-hidden="true" />
                        Reject AI
                      </button>

                      <button
                        type="button"
                        className="status-action-btn limited"
                        onClick={() => handleReverify(activeIncident._id)}
                      >
                        <FaWandMagicSparkles aria-hidden="true" />
                        Re-Verify
                      </button>
                    </div>
                    </div>

                    <div className="incident-review-section incident-system-section">
                    <div className="incident-review-section-head compact">
                      <div>
                        <h3>System Metadata</h3>
                      </div>
                    </div>

                    <div className="incident-metadata-grid incident-system-grid">
                      <div className="incident-meta-item">
                        <span>Created</span>
                        <strong>
                          {formatDateTime(
                            activeIncident.createdAt ||
                              activeIncident.date ||
                              activeIncident.reportedAt
                          )}
                        </strong>
                      </div>

                      <div className="incident-meta-item">
                        <span>Updated</span>
                        <strong>{formatDateTime(activeIncident.updatedAt)}</strong>
                      </div>

                      <div className="incident-meta-item">
                        <span>Image Time</span>
                        <strong>
                          {activeAI.metadata?.timestamp
                            ? formatTimestamp(activeAI.metadata.timestamp)
                            : "Unknown date"}
                        </strong>
                      </div>

                      <div className="incident-meta-item">
                        <span>Device</span>
                        <strong>{activeAI.metadata?.device || "-"}</strong>
                      </div>

                      <div className="incident-meta-item">
                        <span>GPS</span>
                        <strong>
                          {activeAI.metadata?.hasGPS ? "Present" : "No GPS"}
                        </strong>
                      </div>

                      <div className="incident-meta-item">
                        <span>Within Area</span>
                        <strong>
                          {activeAI.metadata?.isWithinArea
                            ? "Within Jaen"
                            : "Unknown / outside"}
                        </strong>
                      </div>
                    </div>
                    </div>

                    <div className="incident-review-danger-row">
                      <button
                        type="button"
                        className="delete-row-btn review-delete-btn"
                        onClick={() => handleDelete(activeIncident._id)}
                      >
                        <FaTrashCan aria-hidden="true" />
                        Delete Incident
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="incident-empty-detail incident-review-empty">
                <div>
                  <span className="empty-state-icon">
                    <FaBell aria-hidden="true" />
                  </span>
                  <strong>No selected incident</strong>
                  <span>
                    Select a report from the queue or adjust your filters to show
                    available incidents.
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

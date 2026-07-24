import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../../config/api";

const BASE_URL = API_BASE_URL;
const DEFAULT_CAMERA_ID = "cam_1";
const DAILY_HISTORY_LIMIT = 7;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDateTime(value) {
  if (!value) return "No sync yet";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No sync yet";

  return parsed.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatShortDate(value) {
  if (!value) return "Unknown day";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
}

function getStatusTone(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DANGER") return "danger";
  if (normalized === "WARNING") return "warning";
  return "safe";
}

function getStatusLabel(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "DANGER") return "Danger";
  if (normalized === "WARNING") return "Warning";
  return "Safe";
}

async function fetchJson(path) {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed.");
  }

  return response.json();
}

export default function PublicDigitalTwinPanel() {
  const iframeRef = useRef(null);
  const [allReadings, setAllReadings] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(DEFAULT_CAMERA_ID);
  const [latestReading, setLatestReading] = useState(null);
  const [dailyHistory, setDailyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const cameraIds = useMemo(() => {
    const unique = Array.from(
      new Set(
        (allReadings || [])
          .map((item) => String(item?.camera_id || "").trim())
          .filter(Boolean)
      )
    );

    return unique.length ? unique : [DEFAULT_CAMERA_ID];
  }, [allReadings]);

  const currentLevel = toNumber(latestReading?.water_level, 0);
  const warningLevel = toNumber(latestReading?.warning_level, 8);
  const dangerLevel = toNumber(latestReading?.danger_level, 10);
  const currentStatus = String(latestReading?.status || "SAFE").toUpperCase();
  const statusTone = getStatusTone(currentStatus);
  const latestTimestamp = latestReading?.timestamp || latestReading?.createdAt || lastSyncedAt;

  const fetchTwinData = useCallback(async () => {
    const data = await fetchJson("/api/water-levels");
    const items = Array.isArray(data?.data) ? data.data : [];
    setAllReadings(items);

    const availableCameras = Array.from(
      new Set(
        items.map((item) => String(item?.camera_id || "").trim()).filter(Boolean)
      )
    );

    if (!availableCameras.includes(selectedCamera)) {
      setSelectedCamera(availableCameras[0] || DEFAULT_CAMERA_ID);
    }
  }, [selectedCamera]);

  const fetchSelectedCameraData = useCallback(
    async (cameraId) => {
      if (!cameraId) return;

      setHistoryLoading(true);

      const [latestResult, dailyHistoryResult] = await Promise.all([
        fetchJson(`/api/water-levels/latest/${encodeURIComponent(cameraId)}`).catch(
          (latestError) => ({ error: latestError })
        ),
        fetchJson(
          `/api/water-levels/history/daily?camera_id=${encodeURIComponent(
            cameraId
          )}&limit=${DAILY_HISTORY_LIMIT}`
        ).catch((historyError) => ({ error: historyError })),
      ]);

      if (latestResult?.error) {
        throw latestResult.error;
      }

      if (dailyHistoryResult?.error) {
        throw dailyHistoryResult.error;
      }

      const nextLatest = latestResult || null;
      const nextDailyHistory = Array.isArray(dailyHistoryResult?.data)
        ? dailyHistoryResult.data
        : [];

      setLatestReading(nextLatest);
      setDailyHistory(nextDailyHistory);
      setLastSyncedAt(new Date().toISOString());
      setHistoryLoading(false);
    },
    []
  );

  useEffect(() => {
    let isActive = true;

    const load = async () => {
      try {
        setError("");
        setLoading(true);
        await fetchTwinData();
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError?.message || "Unable to load Digital Twin data.");
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [fetchTwinData]);

  useEffect(() => {
    let isActive = true;

    const loadCamera = async () => {
      try {
        setError("");
        await fetchSelectedCameraData(selectedCamera);
      } catch (loadError) {
        if (!isActive) return;
        setError(loadError?.message || "Unable to load Digital Twin data.");
        setDailyHistory([]);
      } finally {
        if (isActive) {
          setLoading(false);
          setHistoryLoading(false);
        }
      }
    };

    loadCamera();

    return () => {
      isActive = false;
    };
  }, [fetchSelectedCameraData, selectedCamera]);

  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return;

    iframeRef.current.contentWindow.postMessage(
      {
        type: "SAGIP_WATER_LEVEL_UPDATE",
        payload: {
          camera_id: selectedCamera,
          water_level: currentLevel,
          warning_level: warningLevel,
          danger_level: dangerLevel,
          status: currentStatus,
          timestamp: latestTimestamp || null,
          history: dailyHistory,
        },
      },
      "*"
    );
  }, [
    currentLevel,
    currentStatus,
    dailyHistory,
    dangerLevel,
    latestTimestamp,
    selectedCamera,
    warningLevel,
  ]);

  return (
    <div className="landing-twin-stage">
      <div className="landing-twin-data-card">
        <div className="landing-twin-topbar">
          <div>
            <span className="landing-twin-kicker">Public Water Monitoring</span>
            <h2>Digital Twin</h2>
          </div>

          <div className={`landing-twin-status-pill ${statusTone}`}>
            <span className="landing-twin-status-dot" aria-hidden="true" />
            {getStatusLabel(currentStatus)}
          </div>
        </div>

        <div className="landing-twin-toolbar">
          <label className="landing-twin-camera-picker">
            <span>Camera</span>
            <select
              value={selectedCamera}
              onChange={(event) => setSelectedCamera(event.target.value)}
            >
              {cameraIds.map((cameraId) => (
                <option key={cameraId} value={cameraId}>
                  {cameraId}
                </option>
              ))}
            </select>
          </label>

          <div className="landing-twin-sync-chip">
            Last Sync: {formatDateTime(lastSyncedAt)}
          </div>
        </div>

        <div className="landing-twin-summary-grid">
          <article className="landing-twin-summary-card">
            <span>Current Level</span>
            <strong>{currentLevel.toFixed(2)} m</strong>
          </article>

          <article className="landing-twin-summary-card">
            <span>Warning Level</span>
            <strong>{warningLevel.toFixed(2)} m</strong>
          </article>

          <article className="landing-twin-summary-card">
            <span>Danger Level</span>
            <strong>{dangerLevel.toFixed(2)} m</strong>
          </article>

          <article className="landing-twin-summary-card">
            <span>History Days</span>
            <strong>{dailyHistory.length}</strong>
          </article>
        </div>

        {error ? (
          <div className="landing-twin-inline-alert error">{error}</div>
        ) : loading ? (
          <div className="landing-twin-inline-alert loading">
            Loading Digital Twin data...
          </div>
        ) : null}

        <div className="landing-twin-board">
          <div className="landing-twin-frame-card">
            <iframe
              ref={iframeRef}
              title="SagipBayan Digital Twin"
              src="/unity/digital-twin/index.html"
              className="landing-twin-frame"
              allowFullScreen
            />
          </div>

          <aside className="landing-twin-history-card">
            <div className="landing-twin-history-head">
              <h3>Recent Daily Trend</h3>
              <span>{selectedCamera}</span>
            </div>

            {historyLoading ? (
              <div className="landing-twin-history-empty">Loading history...</div>
            ) : dailyHistory.length ? (
              <div className="landing-twin-history-list">
                {dailyHistory.map((entry) => (
                  <div key={`${entry.camera_id}-${entry.date}`} className="landing-twin-history-item">
                    <div className="landing-twin-history-copy">
                      <strong>{formatShortDate(entry.date)}</strong>
                      <span>
                        {toNumber(entry.minimum_level).toFixed(2)} m to{" "}
                        {toNumber(entry.maximum_level).toFixed(2)} m
                      </span>
                    </div>

                    <div className="landing-twin-history-meta">
                      <span
                        className={`landing-twin-history-status ${getStatusTone(
                          entry.latest_status
                        )}`}
                      >
                        {getStatusLabel(entry.latest_status)}
                      </span>
                      <small>{toNumber(entry.latest_level).toFixed(2)} m</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="landing-twin-history-empty">
                No daily history for this camera yet.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

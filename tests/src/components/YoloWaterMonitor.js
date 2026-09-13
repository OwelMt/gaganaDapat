import React, { useCallback, useEffect, useState } from "react";
import { FaClock, FaPlay, FaStop, FaSyncAlt, FaTint, FaVideo } from "react-icons/fa";
import { API_BASE_URL } from "../config/api";
import "./css/YoloWaterMonitor.css";

export default function YoloWaterMonitor() {
  const [running, setRunning] = useState(false);
  const [waterLevel, setWaterLevel] = useState(null);
  const [loading, setLoading] = useState(false);

  const startYolo = async () => {
    const response = await fetch(`${API_BASE_URL}/api/yolo/start`, {
      method: "POST",
      credentials: "include",
    });

    return response.json();
  };

  const stopYolo = async () => {
    const response = await fetch(`${API_BASE_URL}/api/yolo/stop`, {
      method: "POST",
      credentials: "include",
    });

    return response.json();
  };

  const getYoloStatus = async () => {
    const response = await fetch(`${API_BASE_URL}/api/yolo/status`, {
      credentials: "include",
    });

    return response.json();
  };

  const getLatestWaterLevel = async (cameraId = "cam_1") => {
    const response = await fetch(
      `${API_BASE_URL}/api/water-levels/latest/${cameraId}`,
      {
        credentials: "include",
      }
    );

    return response.json();
  };

  const checkStatus = useCallback(async () => {
    try {
      const data = await getYoloStatus();
      setRunning(Boolean(data.running));
    } catch (error) {
      console.error("YOLO status error:", error);
    }
  }, []);

  const loadLatestWaterLevel = useCallback(async () => {
    try {
      const data = await getLatestWaterLevel("cam_1");
      setWaterLevel(data);
    } catch (error) {
      console.error("Water level error:", error);
    }
  }, []);

  const handleStart = async () => {
    try {
      setLoading(true);

      const data = await startYolo();

      if (!data.success) {
        alert(data.message || "Failed to start YOLO");
        return;
      }

      alert(data.message || "YOLO started");
      checkStatus();
      loadLatestWaterLevel();
    } catch (error) {
      console.error("Start YOLO error:", error);
      alert("Failed to start YOLO");
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      setLoading(true);

      const data = await stopYolo();

      if (!data.success) {
        alert(data.message || "Failed to stop YOLO");
        return;
      }

      alert(data.message || "YOLO stopped");
      checkStatus();
    } catch (error) {
      console.error("Stop YOLO error:", error);
      alert("Failed to stop YOLO");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();
    loadLatestWaterLevel();

    const interval = setInterval(() => {
      checkStatus();
      loadLatestWaterLevel();
    }, 5000);

    return () => clearInterval(interval);
  }, [checkStatus, loadLatestWaterLevel]);

  const waterStatus = String(waterLevel?.status || "No data yet");
  const waterStatusTone = waterStatus.toLowerCase();
  const hasWaterLevel = waterLevel?.water_level !== undefined && waterLevel?.water_level !== null;
  const waterLevelDisplay = hasWaterLevel ? `${waterLevel.water_level} m` : "No data";

  return (
    <main className="yolo-water-page">
      <section className="yolo-water-shell">
        <section className="yolo-monitor-console">
          <div className="yolo-console-header">
            <div className="yolo-console-title">
              <span className="yolo-water-kicker">Water monitoring control</span>
              <h1>YOLO Water Level Monitor</h1>
            </div>

            <div className="yolo-console-status-group" aria-label="Monitor status">
              <span className={`yolo-process-pill ${running ? "is-running" : "is-stopped"}`}>
                <span className="yolo-status-dot" aria-hidden="true" />
                {running ? "Detector running" : "Detector stopped"}
              </span>
              <span className={`yolo-reading-badge ${waterStatusTone}`}>{waterStatus}</span>
            </div>
          </div>

          <div className="yolo-console-body">
            <section className={`yolo-level-panel ${waterStatusTone}`}>
              <span className="yolo-panel-label">
                <FaTint aria-hidden="true" />
                Current Water Level
              </span>
              <strong>{waterLevelDisplay}</strong>
              <small>Camera feed: {waterLevel?.camera_id || "No data yet"}</small>
            </section>

            <section className="yolo-info-panel" aria-label="Latest monitoring details">
              <div className="yolo-info-item">
                <span>
                  <FaVideo aria-hidden="true" />
                  Camera
                </span>
                <strong>{waterLevel?.camera_id || "No data yet"}</strong>
              </div>

              <div className="yolo-info-item">
                <span>
                  <FaClock aria-hidden="true" />
                  Updated
                </span>
                <strong>{waterLevel?.timestamp || "No data yet"}</strong>
              </div>

              <div className="yolo-info-item">
                <span>
                  <FaSyncAlt aria-hidden="true" />
                  Refresh
                </span>
                <strong>Every 5 seconds</strong>
              </div>
            </section>

            <section className="yolo-control-panel" aria-label="YOLO process controls">
              <span className="yolo-panel-label">Process Controls</span>
              <div className="yolo-water-actions">
                <button
                  type="button"
                  className="yolo-water-btn yolo-water-btn-primary"
                  onClick={handleStart}
                  disabled={loading || running}
                >
                  <FaPlay aria-hidden="true" />
                  {loading ? "Loading..." : "Start YOLO"}
                </button>

                <button
                  type="button"
                  className="yolo-water-btn yolo-water-btn-outline"
                  onClick={handleStop}
                  disabled={loading || !running}
                >
                  <FaStop aria-hidden="true" />
                  {loading ? "Loading..." : "Stop YOLO"}
                </button>
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}

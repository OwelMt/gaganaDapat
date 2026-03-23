import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Map from "./map/Map";
import "./map/MapIcon";
import "./css/EManagement.css";
import DashboardShell from "./layout/DashboardShell";

const DEV_DEBUG = false;

const EManagement = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem("role");
    if (!storedRole) {
      navigate("/");
      return;
    }
    fetchPlaces();
  }, [navigate]);

  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [statusChoice, setStatusChoice] = useState("available");
  const [notes, setNotes] = useState(""); // right-panel local-only notes
  const [capacityDisplay, setCapacityDisplay] = useState(0);

  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    capacity: "",
    latitude: null,
    longitude: null,
    extraNotes: "", // persisted (0-30 chars)
  });

  const [pickMode, setPickMode] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState([]);

  const nameRef = useRef(null);

  const [panelView, setPanelView] = useState("main");
  const [historyQuery, setHistoryQuery] = useState("");
  const [historySortBy, setHistorySortBy] = useState("date");
  const [historySortDir, setHistorySortDir] = useState("desc");

  // NEW: delete confirmation panel
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedPlace = useMemo(
    () => places.find((p) => p._id === selectedId) || null,
    [places, selectedId]
  );

  const filteredPlaces = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return places;
    return places.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.location?.toLowerCase().includes(term)
    );
  }, [places, search]);

  useEffect(() => {
    if (!selectedPlace) return;
    setStatusChoice(selectedPlace.capacityStatus || "available");
    setCapacityDisplay(Number(selectedPlace.capacity) || 0);
  }, [selectedPlace]);

  // Selecting from list still zooms to 17 (unchanged)
  useEffect(() => {
    if (!selectedPlace) return;
    const lat = Number(selectedPlace.latitude);
    const lng = Number(selectedPlace.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    window.dispatchEvent(
      new CustomEvent("emap:flyTo", { detail: { lat, lng, zoom: 17 } })
    );
  }, [selectedPlace]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || document.activeElement?.tagName;
      const isField =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable;
      if (isField) return;
      if (e.key === "Escape") {
        if (showAddForm) setShowAddForm(false);
        if (pickMode) setPickMode(false);
        if (panelView === "history") setShowHistory(false);
        if (showDeleteConfirm) setShowDeleteConfirm(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAddForm, pickMode, panelView, showDeleteConfirm]);

  useEffect(() => {
    if (showAddForm && nameRef.current) {
      const t = setTimeout(() => nameRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [showAddForm]);

  useEffect(() => {
    if (showHistory) {
      fetchHistory();
      setHistoryQuery("");
      setPanelView("history");
    } else {
      setPanelView("main");
    }
  }, [showHistory]);

  const fetchPlaces = () => {
    axios
      .get("http://localhost:8000/evacs")
      .then((res) => setPlaces(res.data))
      .catch(console.error);
  };

  const updateStatus = (id, status) =>
    axios
      .put(`http://localhost:8000/evacs/${id}/status`, { capacityStatus: status })
      .then(fetchPlaces);

  const deletePlace = (id) => {
    if (!window.confirm) {
      // fallback just in case environment lacks window.confirm (shouldn't happen in browser)
    }
    axios.delete(`http://localhost:8000/evacs/${id}`).then(fetchPlaces);
  };

  const fetchHistory = () => {
    axios
      .get("http://localhost:8000/evacs/history/logs")
      .then((res) => setHistory(res.data))
      .catch(console.error);
  };

  const sanitizeText = (value) => value.replace(/<[^>]*>?/gm, "");

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "capacity"
          ? value.replace(/\D/g, "")
          : name === "extraNotes"
          ? sanitizeText(value).slice(0, 30) // enforce 30-char max
          : sanitizeText(value),
    }));
  };

  const handleLatitudeChange = (e) => {
    const v = e.target.value.trim();
    if (v === "") {
      setFormData((prev) => ({ ...prev, latitude: null }));
      return;
    }
    const num = Number(v);
    if (Number.isNaN(num)) return;
    setFormData((prev) => ({ ...prev, latitude: num }));
  };

  const handleLongitudeChange = (e) => {
    const v = e.target.value.trim();
    if (v === "") {
      setFormData((prev) => ({ ...prev, longitude: null }));
      return;
    }
    const num = Number(v);
    if (Number.isNaN(num)) return;
    setFormData((prev) => ({ ...prev, longitude: num }));
  };

  const handleStartPick = () => {
    setFormData({
      name: "",
      location: "",
      capacity: "",
      latitude: null,
      longitude: null,
      extraNotes: "",
    });
    setPickMode(true);
    setShowAddForm(false);
  };

  // Fly helper — used ONLY in pick mode
  const flyTo = (lat, lng, zoom = 18) => {
    if (lat == null || lng == null) return;
    window.dispatchEvent(new CustomEvent("emap:flyTo", { detail: { lat, lng, zoom } }));
  };

  // Normalize args from Map -> supports {latlng:{lat,lng}, label?} or (label, lat, lng)
  const normalizeMapArgs = (...args) => {
    let loc = "", lat = null, lng = null;
    if (args.length === 1 && args[0]?.latlng) {
      lat = args[0].latlng.lat;
      lng = args[0].latlng.lng;
      loc = args[0].label || "";
    } else if (args.length >= 3) {
      loc = args[0];
      lat = Number(args[1]);
      lng = Number(args[2]);
    }
    return { loc, lat, lng };
  };

  // Only zoom when ADDING a place
  const handleMapSelectLocation = useCallback((...args) => {
    const { loc, lat, lng } = normalizeMapArgs(...args);
    if (lat == null || lng == null) return;

    if (pickMode) {
      const clean = (v) => (v || "").replace(/<[^>]*>?/gm, "").trim();
      setFormData((prev) => ({
        ...prev,
        name: "",
        location: clean(loc || ""),
        capacity: "",
        latitude: lat,
        longitude: lng,
        // preserve extraNotes that user may have typed before picking
      }));
      setPickMode(false);
      setShowAddForm(true);
      flyTo(lat, lng, 18);
    }
  }, [pickMode]);

  const handleSubmitAdd = () => {
    const { name, location, capacity, latitude, longitude, extraNotes } = formData;

    if (!name || !location || !capacity || latitude === null || longitude === null) {
      alert("Please fill in all fields, including latitude and longitude.");
      return;
    }
    if (latitude < -90 || latitude > 90) {
      alert("Latitude must be between -90 and 90.");
      return;
    }
    if (longitude < -180 || longitude > 180) {
      alert("Longitude must be between -180 and 180.");
      return;
    }

    const trimmedNotes = (extraNotes || "").slice(0, 30);

    setLoading(true);
    axios.post("http://localhost:8000/evacs/make", {
      ...formData,
      capacity: Number(capacity),
      latitude: Number(latitude),
      longitude: Number(longitude),
      extraNotes: trimmedNotes, // include extra notes in payload
    })
      .then(() => {
        setFormData({
          name: "",
          location: "",
          capacity: "",
          latitude: null,
          longitude: null,
          extraNotes: "",
        });
        setShowAddForm(false);
        fetchPlaces();
      })
      .catch(() => alert("Error saving data"))
      .finally(() => setLoading(false));
  };

  const historySorted = useMemo(() => {
    const q = historyQuery.trim().toLowerCase();
    const filtered = history.filter((h) => {
      if (!q) return true;
      return (
        String(h.action ?? "").toLowerCase().includes(q) ||
        String(h.placeName ?? "").toLowerCase().includes(q) ||
        String(h.details ?? "").toLowerCase().includes(q)
      );
    });

    const cmp = (a, b) => {
      let result = 0;
      if (historySortBy === "date") {
        const vA = new Date(a.createdAt).getTime() || 0;
        const vB = new Date(b.createdAt).getTime() || 0;
        result = vA - vB;
      } else if (historySortBy === "action") {
        result = String(a.action ?? "").localeCompare(String(b.action ?? ""), undefined, { sensitivity: "base" });
      } else {
        result = String(a.placeName ?? "").localeCompare(String(b.placeName ?? ""), undefined, { sensitivity: "base" });
      }
      return historySortDir === "asc" ? result : -result;
    };

    return filtered.slice().sort(cmp);
  }, [history, historyQuery, historySortBy, historySortDir]);

  // Clean legend for the right panel
  const Legend = () => (
    <div className="evac-legend" style={{
      marginTop: 10,
      padding: "8px 10px",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      background: "#fff",
    }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", marginBottom: 6 }}>
        Legend
      </div>
      <div style={{ display: "grid", rowGap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="evac-dot dot-green" />
          <span style={{ fontSize: 12, color: "#374151" }}>Available</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="evac-dot dot-orange" />
          <span style={{ fontSize: 12, color: "#374151" }}>Limited</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="evac-dot dot-red" />
          <span style={{ fontSize: 12, color: "#374151" }}>Full</span>
        </div>
      </div>
    </div>
  );

  const extraNotesCount = (formData.extraNotes || "").length;

  return (
    <DashboardShell>
      {/* Lock the entire screen area (under header). Page doesn't scroll. */}
      <div className="evac-screen-lock">
        {/* Split canvas: map | panel */}
        <div className="evac-page">
          {/* Map */}
          <div
            className="evac-map"
            style={{ cursor: pickMode ? "crosshair" : "default", position: "relative" }}
          >
            <Map onSelectLocation={handleMapSelectLocation} places={places} />

            {pickMode && (
              <div
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  background: "rgba(255,255,255,0.95)",
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "10px 12px",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  zIndex: 10,
                  pointerEvents: "none",
                }}
              >
                <span style={{ fontWeight: 700 }}>Click on the map to set location…</span>
                <button
                  onClick={() => setPickMode(false)}
                  style={{
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    borderRadius: 6,
                    height: 30,
                    padding: "0 10px",
                    cursor: "pointer",
                    pointerEvents: "auto",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <aside className={`evac-panel ${panelView === "history" ? "history-open" : ""}`}>
            <div className="panel-views">
              {/* MAIN VIEW */}
              <section className="view-main">
                <div className="evac-brand">
                  <img
                    src="/logo-pasig.svg"
                    alt="Pasig"
                    className="evac-brand-logo"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  <div className="evac-brand-title">Evacuation Center Management</div>
                </div>

                <div className="evac-search">
                  <input
                    type="text"
                    placeholder="Search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoComplete="off"
                  />
                </div>

                {/* Legend */}
                <Legend />

                <div className="evac-list">
                  {filteredPlaces.length === 0 ? (
                    <div className="evac-empty">No places found.</div>
                  ) : (
                    filteredPlaces.map((p) => (
                      <label
                        key={p._id}
                        className={`evac-list-item ${selectedId === p._id ? "selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="selectedPlace"
                          checked={selectedId === p._id}
                          onChange={() => setSelectedId(p._id)}
                        />
                        <span className="evac-list-name">{p.name}</span>
                        <span className="evac-list-loc">{p.location}</span>
                        <span
                          className={`evac-dot ${
                            (p.capacityStatus || "available") === "available"
                              ? "dot-green"
                              : (p.capacityStatus || "available") === "limited"
                              ? "dot-orange"
                              : "dot-red"
                          }`}
                        />
                      </label>
                    ))
                  )}
                </div>

                <div className="evac-capacity">
                  <button
                    className="cap-btn"
                    onClick={() => setCapacityDisplay((n) => Math.max(0, (Number(n) || 0) - 1))}
                  >
                    −
                  </button>
                  <input
                    className="cap-input"
                    type="number"
                    value={capacityDisplay}
                    onChange={(e) => setCapacityDisplay(e.target.value)}
                    autoComplete="off"
                  />
                  <button
                    className="cap-btn"
                    onClick={() => setCapacityDisplay((n) => (Number(n) || 0) + 1)}
                  >
                    +
                  </button>
                </div>

                <div className="evac-status">
                  <label className="status-label">Status</label>
                  <div className="status-row">
                    {["available", "limited", "full"].map((s) => (
                      <label key={s} className="status-pill">
                        <input
                          type="radio"
                          name="statusChoice"
                          checked={statusChoice === s}
                          onChange={() => setStatusChoice(s)}
                        />
                        <span className="pill-text">
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="evac-selected">
                  <label>Selected Place</label>
                  <input
                    readOnly
                    value={
                      selectedPlace ? `${selectedPlace.name} — ${selectedPlace.location}` : ""
                    }
                    placeholder="(none)"
                  />
                </div>

                <div className="evac-notes">
                  <label>Extra notes (local)</label>
                  <textarea
                    rows={3}
                    placeholder="Add notes (local only)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    autoComplete="off"
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      resize: "vertical",
                      maxHeight: 160,
                      overflowX: "hidden",
                    }}
                  />
                </div>

                <div className="evac-actions">
                  <button className="btn btn-back" onClick={() => navigate(-1)}>
                    BACK
                  </button>
                  <button
                    className="btn btn-update"
                    disabled={!selectedId}
                    onClick={async () => {
                      if (!selectedId) {
                        alert("Select a place first");
                        return;
                      }
                      await updateStatus(selectedId, statusChoice);
                    }}
                  >
                    UPDATE
                  </button>
                </div>

                <div className="evac-utils">
                  <button className="link-btn" onClick={handleStartPick}>
                    + Add Place
                  </button>
                  <button
                    className="link-btn"
                    onClick={() => {
                      setShowHistory((v) => !v);
                      fetchHistory();
                    }}
                  >
                    {showHistory ? "Hide History" : "Show History"}
                  </button>

                  {selectedPlace && (
                    <button
                      className="link-btn danger"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete Selected
                    </button>
                  )}
                </div>

                {showHistory && history.length > 0 && (
                  <div className="evac-history">
                    <div className="history-title">History</div>
                    <div className="history-list">
                      {history.map((h) => (
                        <div className="history-item" key={h._id}>
                          <div className="history-main">
                            <span className="history-action">{h.action}</span>
                            <span className="history-place">• {h.placeName}</span>
                          </div>
                          <div className="history-sub">
                            <span className="history-details">{h.details}</span>
                            <span className="history-date">
                              {new Date(h.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* HISTORY VIEW */}
              <section className="view-history">
                <div className="history-toolbar">
                  <button className="tbtn tbtn-light" onClick={() => setShowHistory(false)}>
                    ← Back
                  </button>

                  <div className="history-search">
                    <input
                      type="text"
                      placeholder="Search history (action, place, details)…"
                      value={historyQuery}
                      onChange={(e) => setHistoryQuery(e.target.value)}
                    />
                  </div>

                  <div className="history-sort">
                    <label>Sort by:</label>
                    <select
                      value={historySortBy}
                      onChange={(e) => setHistorySortBy(e.target.value)}
                    >
                      <option value="date">Date</option>
                      <option value="action">Action</option>
                      <option value="place">Place</option>
                    </select>
                    <button
                      type="button"
                      className="sort-dir"
                      title={`Toggle ${historySortDir === "asc" ? "descending" : "ascending"}`}
                      onClick={() => setHistorySortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    >
                      {historySortDir === "asc" ? "↑" : "↓"}
                    </button>
                  </div>
                </div>

                <div className="history-body">
                  <div className="evac-history-panel">
                    {historySorted.map((h) => (
                      <div className="history-card" key={h._id}>
                        <div className="h-row">
                          <strong className="h-action">{h.action}</strong>
                          <span className="h-place">• {h.placeName}</span>
                        </div>
                        <div className="h-sub">{h.details}</div>
                        <div className="h-date">
                          {h.createdAt ? new Date(h.createdAt).toLocaleString() : "-"}
                        </div>
                      </div>
                    ))}
                    {history.length === 0 && <div className="evac-empty">No history yet.</div>}
                  </div>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>

      {/* Add Place Modal */}
      {showAddForm &&
        createPortal(
          <div
            className="evac-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add Evacuation Place"
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.4)",
              display: "grid",
              placeItems: "center",
              zIndex: 1000,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key !== "Escape") e.stopPropagation();
            }}
          >
            <div
              className="evac-modal-card"
              style={{
                width: "min(100%, 960px)",   // full width within cap
                maxWidth: "96vw",
                maxHeight: "min(92vh, 900px)", // taller
                overflow: "hidden",            // prevents horizontal overflow at card level
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                padding: 12,
                boxShadow: "0 14px 40px rgba(0,0,0,0.18)",
                boxSizing: "border-box",
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setShowAddForm(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="modal-header"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 2px 10px 2px",
                  borderBottom: "1px solid #e5e7eb",
                }}
              >
                <div
                  className="modal-title"
                  style={{ fontSize: 16, fontWeight: 800, color: "#1f2937" }}
                >
                  Add Evacuation Place
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  ✕
                </button>
              </div>

              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmitAdd();
                }}
                className="modal-form"
                style={{
                  display: "grid",
                  gap: 12,
                  paddingTop: 12,
                  maxHeight: "calc(92vh - 120px)",
                  overflowY: "auto",
                  overflowX: "hidden", // never horizontally scroll
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") e.stopPropagation();
                }}
              >
                <div className="modal-body" style={{ display: "grid", gap: 12 }}>
                  <div>
                    <label>Place Name</label>
                    <textarea
                      ref={nameRef}
                      name="name"
                      rows={2}
                      value={formData.name}
                      onChange={handleFieldChange}
                      autoComplete="off"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label>Location</label>
                    <textarea
                      name="location"
                      rows={2}
                      value={formData.location}
                      onChange={handleFieldChange}
                      autoComplete="off"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <label>Capacity</label>
                    <input
                      name="capacity"
                      type="number"
                      value={formData.capacity}
                      onChange={handleFieldChange}
                      autoComplete="off"
                      inputMode="numeric"
                      style={{ width: "100%", boxSizing: "border-box" }}
                    />
                  </div>

                  {/* Editable Latitude / Longitude */}
                  <div>
                    <label>Latitude / Longitude</label>
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                      width: "100%",
                    }}>
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="Latitude (-90 to 90)"
                        value={
                          formData.latitude === null || Number.isNaN(formData.latitude)
                            ? ""
                            : String(formData.latitude)
                        }
                        onChange={handleLatitudeChange}
                        autoComplete="off"
                        min={-90}
                        max={90}
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                      <input
                        type="number"
                        step="0.000001"
                        placeholder="Longitude (-180 to 180)"
                        value={
                          formData.longitude === null || Number.isNaN(formData.longitude)
                            ? ""
                            : String(formData.longitude)
                        }
                        onChange={handleLongitudeChange}
                        autoComplete="off"
                        min={-180}
                        max={180}
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>

                  {/* Extra Notes (30 chars) — taller, never wider than panel */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <label>Extra Notes (max 30)</label>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {extraNotesCount}/30
                      </span>
                    </div>
                    <textarea
                      name="extraNotes"
                      rows={2}
                      value={formData.extraNotes}
                      onChange={handleFieldChange}
                      autoComplete="off"
                      maxLength={30}
                      placeholder="Short note shown in details"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        resize: "vertical",
                        maxHeight: 120,
                        overflowX: "hidden",
                      }}
                    />
                  </div>
                </div>

                <div className="modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-back"
                    onClick={() => setShowAddForm(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-update" disabled={loading}>
                    {loading ? "Submitting..." : "Save Place"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      {/* Delete confirmation panel */}
      {showDeleteConfirm &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Delete Area Confirmation"
            onClick={() => setShowDeleteConfirm(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15,23,42,0.45)",
              display: "grid",
              placeItems: "center",
              zIndex: 1000,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "min(420px, 92vw)",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                boxShadow: "0 14px 40px rgba(0,0,0,0.18)",
                padding: 16,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 10,
                  borderBottom: "1px solid #e5e7eb",
                  paddingBottom: 8,
                }}
              >
                <div style={{ fontWeight: 800, color: "#111827" }}>Confirm Delete</div>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    fontSize: 18,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                  aria-label="Close"
                  title="Close"
                >
                  ✕
                </button>
              </div>

              <div style={{ color: "#374151", marginBottom: 16 }}>
                {selectedPlace ? (
                  <>
                    Do you want to delete this area?
                    <br />
                    <strong>{selectedPlace.name}</strong>
                    {selectedPlace.location ? ` — ${selectedPlace.location}` : ""}
                  </>
                ) : (
                  "Do you want to delete this area?"
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn btn-back"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-update"
                  style={{ background: "#dc2626", borderColor: "#dc2626" }}
                  onClick={() => {
                    if (selectedPlace?._id) {
                      // Call your existing function and refresh
                      axios.delete(`http://localhost:8000/evacs/${selectedPlace._id}`).then(fetchPlaces);
                    }
                    setShowDeleteConfirm(false);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </DashboardShell>
  );
};

export default EManagement;

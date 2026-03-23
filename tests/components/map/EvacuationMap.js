import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Map from "./Map";
import "./MapIcon";

const EvacuationMap = () => {
  const [places, setPlaces] = useState([]);
  const [pickMode, setPickMode] = useState(false);

  // Coordinates
  const [currentCoords, setCurrentCoords] = useState({ lat: null, lng: null });
  const [evacCoords, setEvacCoords] = useState({ lat: null, lng: null });

  // Route
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState({ distance: 0, duration: 0 });

  // Transport mode
  const [transportMode, setTransportMode] = useState("driving");

  /* ---------------- Fetch Evac Centers ---------------- */
  const fetchPlaces = () => {
    axios
      .get("http://localhost:8000/evacs")
      .then((res) => setPlaces(res.data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchPlaces();
  }, []);

  /* ---------------- Map Click ---------------- */
  const handleMapSelectLocation = useCallback(
    (label, lat, lng) => {
      if (!pickMode) return;

      setEvacCoords({ lat, lng });
      setPickMode(false);

      console.log("Selected Evac:", { lat, lng });
    },
    [pickMode]
  );

  /* ---------------- Route Logic ---------------- */
  const fetchRoute = () => {
    if (
      currentCoords.lat === null ||
      currentCoords.lng === null ||
      evacCoords.lat === null ||
      evacCoords.lng === null
    ) {
      alert("Please set both locations first.");
      return;
    }

    const url = `https://router.project-osrm.org/route/v1/driving/${currentCoords.lng},${currentCoords.lat};${evacCoords.lng},${evacCoords.lat}?overview=full&geometries=geojson`;

    axios
      .get(url)
      .then((res) => {
        if (res.data.routes && res.data.routes.length > 0) {
          const route = res.data.routes[0];

          // Convert coordinates
          const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
          setRouteCoords(coords);

          // ✅ Distance in KM
          const distanceKm = route.distance / 1000;

          // ✅ Realistic speeds
          let speed = 35; // driving default

          if (transportMode === "walking") speed = 5;
          else if (transportMode === "cycling") speed = 15;
          else if (transportMode === "driving") speed = 35;

          // ✅ Compute duration manually
          const durationSeconds = (distanceKm / speed) * 3600;

          setRouteInfo({
            distance: route.distance,
            duration: durationSeconds,
          });

          console.log("Mode:", transportMode);
          console.log("Distance:", distanceKm, "km");
          console.log("Duration:", durationSeconds, "sec");
        }
      })
      .catch((err) => console.error("OSRM Error:", err));
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="evac-toolbar">
        <strong>Evacuation Center Management</strong>
        <button className="tbtn" onClick={fetchPlaces}>
          ↻ Refresh
        </button>
      </div>

      {/* Map */}
      <div
        className="evac-map"
        style={{
          width: "100%",
          height: "500px",
          position: "relative",
        }}
      >
        <Map
          onSelectLocation={handleMapSelectLocation}
          places={places}
          currentCoords={currentCoords}
          evacCoords={evacCoords}
          routeCoords={routeCoords}
          routeInfo={routeInfo}
        />

        {pickMode && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "#fff",
              padding: 10,
              borderRadius: 8,
              zIndex: 10,
            }}
          >
            Click map to select evacuation location
            <button onClick={() => setPickMode(false)}>Cancel</button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ marginTop: 12, maxWidth: 320 }}>
        <button onClick={() => setPickMode(true)}>
          Pick Evac Location on Map
        </button>

        {/* Current */}
        <div>
          <p>CURRENT LOCATION</p>
          <input
            type="number"
            placeholder="Latitude"
            value={currentCoords.lat ?? ""}
            onChange={(e) =>
              setCurrentCoords((p) => ({
                ...p,
                lat: parseFloat(e.target.value),
              }))
            }
          />
          <input
            type="number"
            placeholder="Longitude"
            value={currentCoords.lng ?? ""}
            onChange={(e) =>
              setCurrentCoords((p) => ({
                ...p,
                lng: parseFloat(e.target.value),
              }))
            }
          />
        </div>

        {/* Evac */}
        <div>
          <p>EVACUATION LOCATION</p>
          <input
            type="number"
            placeholder="Latitude"
            value={evacCoords.lat ?? ""}
            onChange={(e) =>
              setEvacCoords((p) => ({
                ...p,
                lat: parseFloat(e.target.value),
              }))
            }
          />
          <input
            type="number"
            placeholder="Longitude"
            value={evacCoords.lng ?? ""}
            onChange={(e) =>
              setEvacCoords((p) => ({
                ...p,
                lng: parseFloat(e.target.value),
              }))
            }
          />
        </div>

        {/* Mode */}
        <div>
          <p>Mode of Transport</p>
          <select
            value={transportMode}
            onChange={(e) => setTransportMode(e.target.value)}
          >
            <option value="driving">🚗 Driving</option>
            <option value="walking">🚶 Walking</option>
            <option value="cycling">🚴 Cycling</option>
          </select>
        </div>

        {/* Button */}
        <button onClick={fetchRoute}>Show Route</button>

        {/* Output */}
        {routeCoords.length > 0 && (
          <div>
            <strong>Route Info</strong>
            <div>
              Distance: {(routeInfo.distance / 1000).toFixed(2)} km
            </div>
            <div>
              Duration: {(routeInfo.duration / 60).toFixed(0)} minutes
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvacuationMap;
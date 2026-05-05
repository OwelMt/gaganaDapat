import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMapEvents,
  useMap,
  Polyline,
  GeoJSON,
} from "react-leaflet";
import L from "leaflet";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point as turfPoint } from "@turf/helpers";
import "leaflet/dist/leaflet.css";
import jaenGeoJSON from "../data/jaen.json";
import { Polygon } from "react-leaflet";

const DEFAULT_CENTER = [15.3382, 120.9056];
const BOUNDS_BUFFER = 0.01;

/* ---------------- Icons ---------------- */

const blueIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const greenIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const orangeIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/orange-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const redIcon = new L.Icon({
  iconUrl: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

const greyIcon = L.divIcon({
  className: "custom-evac-archived-marker",
  html: '<span class="custom-evac-archived-marker__dot"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

/* ---------------- Styles ---------------- */

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

function getBarangayColorParts(index = 0) {
  const hue = Math.round((index * 137.508 + 24) % 360);
  const saturationCycle = [78, 64, 86, 58];
  const lightnessCycle = [48, 60, 42, 66];
  const saturation = saturationCycle[index % saturationCycle.length];
  const lightness = lightnessCycle[index % lightnessCycle.length];

  return { hue, saturation, lightness };
}

function getBarangayFillColor(index = 0) {
  const { hue, saturation, lightness } = getBarangayColorParts(index);
  return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.54)`;
}

function getBarangayOutlineColor(index = 0) {
  const { hue, saturation, lightness } = getBarangayColorParts(index);
  return `hsl(${hue}, ${Math.min(88, saturation + 8)}%, ${Math.max(34, lightness - 8)}%)`;
}

/* ---------------- Helpers ---------------- */

function geoJSONToLeafletPolygon(geo) {
  if (!geo) return [];

  // If already Leaflet format
  if (Array.isArray(geo) && typeof geo[0]?.[0] === "number") {
    return geo;
  }

  // GeoJSON Polygon: [[[lng, lat]]]
  if (Array.isArray(geo?.[0]?.[0]?.[0])) {
    return geo.map(polygon =>
      polygon[0].map(([lng, lat]) => [lat, lng])
    );
  }

  // GeoJSON Polygon: [[lng, lat]]
  if (Array.isArray(geo?.[0]?.[0])) {
    return geo[0].map(([lng, lat]) => [lat, lng]);
  }

  return [];
}

function safeLower(value) {
  return String(value || "").toLowerCase().trim();
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
    console.error("Polygon check failed:", error);
    return false;
  }
}

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

function getStatusIcon(placeOrStatus) {
  const place =
    placeOrStatus && typeof placeOrStatus === "object"
      ? placeOrStatus
      : { capacityStatus: placeOrStatus };
  const normalized = safeLower(place?.capacityStatus);

  if (place?.isArchived) return greyIcon;

  if (normalized === "limited") return orangeIcon;
  if (normalized === "full") return redIcon;
  return greenIcon;
}

/* ---------------- Fit map to Jaen ---------------- */

function FitToJaenBounds({ bounds, publicMode = false }) {
  const map = useMap();

  useEffect(() => {
    if (!bounds) return;

    let cancelled = false;

    map.fitBounds(bounds, {
      padding: publicMode ? [28, 28] : [20, 20],
    });

    if (!publicMode) {
      map.setMaxBounds(bounds);
    } else {
      map.setMaxBounds(null);
    }

    const timer = setTimeout(() => {
      if (!cancelled && map?._container) {
        map.invalidateSize();
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [bounds, map, publicMode]);

  return null;
}

/* ---------------- Map Updater ---------------- */

function MapUpdater({ position, zoom, allowedBounds, publicMode = false }) {
  const map = useMap();

  useEffect(() => {
    if (!position) return;

    let cancelled = false;

    const target = L.latLng(position[0], position[1]);

    if (publicMode) {
      map.setView(position, zoom);
    } else if (!allowedBounds || allowedBounds.contains(target)) {
      map.setView(position, zoom);
    }

    const timer = setTimeout(() => {
      if (!cancelled && map?._container) {
        map.invalidateSize();
      }
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [position, zoom, map, allowedBounds, publicMode]);

  useEffect(() => {
    let cancelled = false;

    const handleResize = () => {
      if (map?._container) {
        map.invalidateSize();
      }
    };

    window.addEventListener("resize", handleResize);

    const timer = setTimeout(() => {
      if (!cancelled && map?._container) {
        map.invalidateSize();
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener("resize", handleResize);
    };
  }, [map]);

  return null;
}

/* ---------------- Map Click Handler ---------------- */

function MapClickHandler({
  setPosition,
  setPlaceName,
  onSelectLocation,
  allowedBounds,
  pickMode,
}) {
  useMapEvents({
    click(e) {
      if (!pickMode) return;

      const { lat, lng } = e.latlng;

      if (allowedBounds && !allowedBounds.contains(e.latlng)) return;
      if (!isPointInsideJaen(lat, lng)) return;

      setPosition([lat, lng]);

      axios
        .get("https://nominatim.openstreetmap.org/reverse", {
          params: {
            lat,
            lon: lng,
            format: "json",
            addressdetails: 1,
          },
        })
        .then((res) => {
          let short = "Unknown Location";

          if (res.data.name) {
            short = res.data.name;
          } else if (res.data.address) {
            const a = res.data.address;
            const street =
              a.road || a.pedestrian || a.suburb || a.village || "Unknown Street";
            const city =
              a.city || a.town || a.village || a.county || "Unknown City";
            short = `${street}, ${city}`;
          }

          setPlaceName(short);
          onSelectLocation?.(short, lat, lng);
        })
        .catch(() => {
          setPlaceName("Unknown Location");
          onSelectLocation?.("Unknown Location", lat, lng);
        });
    },
  });

  return null;
}

/* ---------------- MapBusBridge ---------------- */

function MapBusBridge({ allowedBounds, publicMode = false }) {
  const map = useMap();

  useEffect(() => {
    const handler = (e) => {
      const { lat, lng, zoom = 17 } = e.detail || {};

      if (typeof lat !== "number" || typeof lng !== "number") return;

      const target = L.latLng(lat, lng);

      if (!publicMode && allowedBounds && !allowedBounds.contains(target)) return;
      if (!isPointInsideJaen(lat, lng)) return;

      map.flyTo([lat, lng], zoom, { duration: 0.6 });
    };

    window.addEventListener("emap:flyTo", handler);
    return () => window.removeEventListener("emap:flyTo", handler);
  }, [map, allowedBounds, publicMode]);

  return null;
}

/* ---------------- Popup Builders ---------------- */

function renderPublicPopup(place) {
  return (
    <Popup>
      <div className="map-popup public-popup">
        <strong>{place.name}</strong>
        <br />
        {place.location || "No location provided"}
        <br />
        <em>Barangay:</em> {place.barangayName || "-"}
        <br />
        <em>Status:</em> {place.capacityStatus || "available"}
        {place?.isArchived ? " (archived)" : ""}
        <br />
        <em>Tip:</em> Click marker to view the details card
      </div>
    </Popup>
  );
}

function renderOperationalPopup(place) {
  return (
    <Popup>
      <div className="map-popup operational-popup">
        <strong>{place.name}</strong>
        <br />
        {place.location || "No location provided"} —{" "}
        {place.barangayName || place.barangay || "-"}
        <br />
        <em>Capacity:</em> Individual {place.capacityIndividual || 0}, Family{" "}
        {place.capacityFamily || 0}, Bed {place.bedCapacity || 0}
        <br />
        <em>Floor Area:</em> {place.floorArea ?? 0} m²
        <br />
        <em>Facilities:</em>
        {place.femaleCR && " Female CR"}
        {place.maleCR && " Male CR"}
        {place.commonCR && " Common CR"}
        {place.potableWater && " Potable Water"}
        {place.nonPotableWater && " Non-potable Water"}
        {place.foodPackCapacity ? ` | Food Packs: ${place.foodPackCapacity}` : ""}
        <br />
        <em>Flags:</em> {place.isPermanent ? "Permanent " : ""}
        {place.isCovidFacility ? "COVID Facility" : ""}
        <br />
        <em>Status:</em> {place.capacityStatus || "available"}
        {place?.isArchived ? " (archived)" : ""}
        <br />
        <em>Tip:</em> Click marker to open the details panel
      </div>
    </Popup>
  );
}

/* ---------------- Marker Renderer ---------------- */

function FlyToOnClickMarker({
  place,
  icon,
  onSelectLocation,
  onSelectPlace,
  allowedBounds,
  publicMode = false,
}) {
  const map = useMap();
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (!publicMode && allowedBounds && !allowedBounds.contains(L.latLng(lat, lng))) {
    return null;
  }
  if (!isPointInsideJaen(lat, lng)) return null;

  const handleMarkerClick = () => {
    map.flyTo([lat, lng], 17, { duration: 0.6 });
    onSelectLocation?.(place.location || "Unknown Location", lat, lng);
    onSelectPlace?.(place);
  };

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        click: handleMarkerClick,
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -28]}
        opacity={1}
        permanent
        className="evac-marker-label"
      >
        <div className="evac-marker-label__text">{place.name}</div>
      </Tooltip>

      {publicMode ? renderPublicPopup(place) : renderOperationalPopup(place)}
    </Marker>
  );
}

/* =================== MAP COMPONENT =================== */

const Map = ({
  onSelectLocation,
  onSelectPlace,
  places = [],
  barangayBounds = [],
  currentCoords = {},
  evacCoords = {},
  routeCoords = [],
  pickMode = false,
  publicMode = false,
}) => {
  console.log("BARANGAY BOUNDS RECEIVED:", barangayBounds);
  const jaenBounds = useMemo(() => {
    if (!jaenGeoJSON) return null;
    return L.geoJSON(jaenGeoJSON).getBounds();
  }, []);

  const allowedBounds = useMemo(() => {
    if (!jaenBounds) return null;

    return L.latLngBounds(
      [
        [
          jaenBounds.getSouthWest().lat - BOUNDS_BUFFER,
          jaenBounds.getSouthWest().lng - BOUNDS_BUFFER,
        ],
        [
          jaenBounds.getNorthEast().lat + BOUNDS_BUFFER,
          jaenBounds.getNorthEast().lng + BOUNDS_BUFFER,
        ],
      ]
    );
  }, [jaenBounds]);

  const relaxedPublicBounds = useMemo(() => {
    if (!jaenBounds) return null;

    return L.latLngBounds(
      [
        [
          jaenBounds.getSouthWest().lat - 0.08,
          jaenBounds.getSouthWest().lng - 0.08,
        ],
        [
          jaenBounds.getNorthEast().lat + 0.08,
          jaenBounds.getNorthEast().lng + 0.08,
        ],
      ]
    );
  }, [jaenBounds]);

  const effectiveBounds = publicMode ? relaxedPublicBounds : allowedBounds;

  const maskGeoJSON = useMemo(() => {
    return buildInverseMaskGeoJSON(jaenGeoJSON);
  }, []);

  const initialCenter = useMemo(() => {
    if (jaenBounds) {
      const center = jaenBounds.getCenter();
      return [center.lat, center.lng];
    }
    return DEFAULT_CENTER;
  }, [jaenBounds]);

  const [position, setPosition] = useState(initialCenter);
  const [zoom, setZoom] = useState(publicMode ? 12 : 13);
  const [placeName, setPlaceName] = useState("Jaen, Nueva Ecija");

  useEffect(() => {
    setPosition(initialCenter);
  }, [initialCenter]);

  useEffect(() => {
    setZoom(publicMode ? 12 : 13);
  }, [publicMode]);

  return (
    <MapContainer
      center={initialCenter}
      zoom={publicMode ? 12 : 14}
      minZoom={publicMode ? 11 : 13}
      maxZoom={18}
      maxBounds={effectiveBounds || jaenBounds || undefined}
      maxBoundsViscosity={publicMode ? 0.35 : 1.0}
      style={{ height: "100%", width: "100%" }}
      whenCreated={(map) => {
        const timer = setTimeout(() => {
          if (map?._container) {
            map.invalidateSize();
          }
        }, 200);

        return () => clearTimeout(timer);
      }}
    >
      <FitToJaenBounds bounds={jaenBounds} publicMode={publicMode} />
      <MapBusBridge allowedBounds={effectiveBounds} publicMode={publicMode} />
      <MapUpdater
        position={position}
        zoom={zoom}
        allowedBounds={effectiveBounds}
        publicMode={publicMode}
      />

      <MapClickHandler
        setPosition={setPosition}
        setPlaceName={setPlaceName}
        onSelectLocation={onSelectLocation}
        allowedBounds={allowedBounds}
        pickMode={pickMode}
      />

      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />

      <GeoJSON data={maskGeoJSON} style={maskStyle} />
      <GeoJSON data={jaenGeoJSON} style={jaenStyle} />

      {pickMode && (
        <Marker position={position} icon={blueIcon}>
          <Popup>{placeName}</Popup>
        </Marker>
      )}

      {places.map((place) => {
        if (place?.latitude === undefined || place?.longitude === undefined) {
          return null;
        }

        return (
          <FlyToOnClickMarker
            key={place._id}
            place={place}
            icon={getStatusIcon(place)}
            onSelectLocation={onSelectLocation}
            onSelectPlace={onSelectPlace}
            allowedBounds={effectiveBounds}
            publicMode={publicMode}
          />
        );
      })}

      {barangayBounds.map((b, index) => {
        const geo = b.features?.[0]?.geometry || b.geometry;
        console.log("Processing barangay bounds:", b._id || index, "Geo:", geo);

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
            key={b._id || index}
            positions={positions}
            pathOptions={{
              color: getBarangayOutlineColor(index),
              weight: 2,
              fillColor: getBarangayFillColor(index),
              fillOpacity: 0.54,
            }}
          />
        );
      })}

      {currentCoords.lat &&
        currentCoords.lng &&
        isPointInsideJaen(currentCoords.lat, currentCoords.lng) && (
          <Marker
            position={[currentCoords.lat, currentCoords.lng]}
            icon={greenIcon}
          >
            <Popup>Current Location</Popup>
          </Marker>
        )}

      {evacCoords.lat &&
        evacCoords.lng &&
        isPointInsideJaen(evacCoords.lat, evacCoords.lng) && (
          <Marker position={[evacCoords.lat, evacCoords.lng]} icon={redIcon}>
            <Popup>Evacuation Location</Popup>
          </Marker>
        )}

      {routeCoords.length > 0 && (
        <Polyline positions={routeCoords} color="blue" />
      )}
      
    </MapContainer>
  );
};

export default Map;

import { useState, useEffect } from "react";
import axios from "axios";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
  Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const PASIG_CENTER = [15.3382, 120.9056];

/* ---------------- Icons (unchanged) ---------------- */

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

/* ---------------- Map Updater ---------------- */
function MapUpdater({ position, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position, zoom);
  }, [position, zoom, map]);
  return null;
}

/* ---------------- Map Click Handler ---------------- */
function MapClickHandler({ setPosition, setPlaceName, onSelectLocation }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      setPosition([lat, lng]);

      axios
        .get("https://nominatim.openstreetmap.org/reverse", {
          params: { lat, lon: lng, format: "json", addressdetails: 1 },
        })
        .then((res) => {
          let short = "Unknown Location";
          if (res.data.name) short = res.data.name;
          else if (res.data.address) {
            const a = res.data.address;
            const street =
              a.road || a.pedestrian || a.suburb || a.village || "Unknown Street";
            const city =
              a.city || a.town || a.village || a.county || "Unknown City";
            short = `${street}, ${city}`;
          }

          setPlaceName(short);
          onSelectLocation(short, lat, lng);
        })
        .catch(() => {
          setPlaceName("Unknown Location");
          onSelectLocation("Unknown Location", lat, lng);
        });
    },
  });
  return null;
}

/* ---------------- MapBusBridge ---------------- */
function MapBusBridge() {
  const map = useMap();
  useEffect(() => {
    const handler = (e) => {
      const { lat, lng, zoom = 17 } = e.detail || {};
      if (typeof lat === "number" && typeof lng === "number") {
        map.flyTo([lat, lng], zoom, { duration: 0.6 });
      }
    };
    window.addEventListener("emap:flyTo", handler);
    return () => window.removeEventListener("emap:flyTo", handler);
  }, [map]);
  return null;
}

/* ---------------- FlyToOnClickMarker ---------------- */
function FlyToOnClickMarker({ place, icon, onSelectLocation }) {
  const map = useMap();
  const lat = Number(place.latitude);
  const lng = Number(place.longitude);

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        click: () => {
          map.flyTo([lat, lng], 17, { duration: 0.6 });
          onSelectLocation?.(place.location || "Unknown Location", lat, lng);
        },
      }}
    >
      <Popup>
        <strong>{place.name}</strong>
        <br />
        {place.location}
        <br />
        Capacity: {place.capacity}
        <br />
        Status: {place.capacityStatus}
      </Popup>
    </Marker>
  );
}

/* =================== MAP COMPONENT =================== */
const Map = ({
  onSelectLocation,
  places = [],
  currentCoords = {},
  evacCoords = {},
  routeCoords = [],
}) => {
  const [position, setPosition] = useState(PASIG_CENTER);
  const [zoom, setZoom] = useState(13);
  const [placeName, setPlaceName] = useState("Pasig City");

  return (
    <MapContainer
      center={position}
      zoom={zoom}
      style={{ height: "100%", width: "100%" }}
    >
      <MapBusBridge />
      <MapUpdater position={position} zoom={zoom} />
      <MapClickHandler
        setPosition={setPosition}
        setPlaceName={setPlaceName}
        onSelectLocation={onSelectLocation}
      />
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />

      {/* Clicked pin for Add Place picking */}
      <Marker position={position} icon={blueIcon}>
        <Popup>{placeName}</Popup>
      </Marker>

      {/* Evacuation centers */}
      {places.map((place) => {
        if (place.latitude === undefined || place.longitude === undefined)
          return null;

        let icon = greenIcon;
        if (place.capacityStatus === "limited") icon = orangeIcon;
        else if (place.capacityStatus === "full") icon = redIcon;

        return (
          <FlyToOnClickMarker
            key={place._id}
            place={place}
            icon={icon}
            onSelectLocation={onSelectLocation}
          />
        );
      })}

      {/* Current location marker */}
      {currentCoords.lat && currentCoords.lng && (
        <Marker position={[currentCoords.lat, currentCoords.lng]} icon={greenIcon}>
          <Popup>Current Location</Popup>
        </Marker>
      )}

      {/* Evacuation location marker */}
      {evacCoords.lat && evacCoords.lng && (
        <Marker position={[evacCoords.lat, evacCoords.lng]} icon={redIcon}>
          <Popup>Evacuation Location</Popup>
        </Marker>
      )}

      {/* OSRM Route Polyline */}
      {routeCoords.length > 0 && <Polyline positions={routeCoords} color="blue" />}
    </MapContainer>

    
  );
};

export default Map;
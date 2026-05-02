const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const session = require("express-session");
const dotenv = require("dotenv");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

dotenv.config();

// --------------------
// Routes
// --------------------
const userRoutes = require("./routes/userRoutes");
const incidentRoutes = require("./routes/incidentRoutes");
const historyRoutes = require("./routes/historyRoutes");
const evacRoutes = require("./routes/EvacRoutes");
const authRoutes = require("./routes/authRoutes");
const barangayRoutes = require("./routes/barangayRoutes");
const drrmoRoutes = require("./routes/drrmoRoutes");
const reliefTrackingRoutes = require("./routes/reliefTrackingRoutes");
const auditRoutes = require("./routes/auditRoutes");
const guidelineRoutes = require("./routes/GuidelineRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const timeInOutRoutes = require("./routes/timeInOutRoutes");
const editRoutes = require("./routes/editRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const reliefRequestRoutes = require("./routes/reliefRequestRoutes");
const reliefReleaseRoutes = require("./routes/reliefReleaseRoutes");
const foodPackRoutes = require("./routes/foodPackRoutes");
const publicSiteRoutes = require("./routes/publicSiteRoutes");
const reliefAnalyticsRoutes = require("./routes/reliefAnalyticsRoutes");
const incidentAnalyticsRoutes = require("./routes/incidentAnalyticsRoutes");
const evacAnalyticsRoutes = require("./routes/EvacAnalyticsRoutes");
const overviewAnalyticsRoutes = require("./routes/overviewAnalysticsRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const waterLevelRoutes = require('./routes/waterLevelRoutes');

const app = express();
app.set("trust proxy", 1);

// --------------------
// Upload folders
// --------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const guidelinesDir = path.join(uploadDir, "guidelines");
if (!fs.existsSync(guidelinesDir)) fs.mkdirSync(guidelinesDir, { recursive: true });

const inventoryDir = path.join(uploadDir, "inventory");
if (!fs.existsSync(inventoryDir)) fs.mkdirSync(inventoryDir, { recursive: true });

const goodsDir = path.join(uploadDir, "goods");
if (!fs.existsSync(goodsDir)) fs.mkdirSync(goodsDir, { recursive: true });

const monetaryDir = path.join(uploadDir, "monetary");
if (!fs.existsSync(monetaryDir)) fs.mkdirSync(monetaryDir, { recursive: true });

const proofsDir = path.join(uploadDir, "proofs");
if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir, { recursive: true });

const reliefRequestsDir = path.join(uploadDir, "relief-requests");
if (!fs.existsSync(reliefRequestsDir)) {
  fs.mkdirSync(reliefRequestsDir, { recursive: true });
}

// --------------------
// Body parsers
// --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------
// CORS
// --------------------
const FRONTEND_URLS = [
  "http://localhost:3000",
  "http://localhost:8081",
  "https://sagipbayan.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || FRONTEND_URLS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// --------------------
// Session
// --------------------
const isProd = process.env.NODE_ENV === "production";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    proxy: isProd,
    cookie: {
      secure: isProd,
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

// --------------------
// DEBUG middleware
// --------------------
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  console.log("SESSION:", req.session);
  next();
});

// --------------------
// Debug route
// --------------------
app.get("/api/debug-express", (req, res) => {
  res.json({
    message: "EXPRESS WORKING",
    session: req.session,
  });
});

// --------------------
// Serve uploads
// --------------------
app.use("/uploads", express.static(uploadDir));
app.use("/uploads/guidelines", express.static(guidelinesDir));
app.use("/uploads/inventory", express.static(inventoryDir));
app.use("/uploads/goods", express.static(goodsDir));
app.use("/uploads/monetary", express.static(monetaryDir));
app.use("/uploads/proofs", express.static(proofsDir));
app.use("/uploads/relief-requests", express.static(reliefRequestsDir));

// --------------------
// API Routes
// --------------------
app.use("/api/guidelines", guidelineRoutes);
app.use("/user", userRoutes);
app.use("/incident", incidentRoutes);
app.use("/history", historyRoutes);
app.use("/evacs", evacRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/barangays", barangayRoutes);
app.use("/api/drrmo", drrmoRoutes);
app.use("/api/relief-tracking", reliefTrackingRoutes);
app.use("/api/audit", auditRoutes);
app.use("/connection", connectionRoutes);
app.use("/api/timeinout", timeInOutRoutes);
app.use("/api/edit", editRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/relief-requests", reliefRequestRoutes);
app.use("/api/relief-releases", reliefReleaseRoutes);
app.use("/api/food-pack-templates", foodPackRoutes);
app.use("/api/public-site", publicSiteRoutes);
app.use("/api/relief-analytics", reliefAnalyticsRoutes);
app.use("/api/incident-analytics", incidentAnalyticsRoutes);
app.use("/api/evac-analytics", evacAnalyticsRoutes);
app.use("/api/overview-analytics", overviewAnalyticsRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/water-levels", waterLevelRoutes);

// --------------------
// Hazard proxy
// --------------------
app.get("/hazards", async (req, res) => {
  try {
    const citiesRes = await fetch("https://api.mapakalamidad.ph/cities");
    const citiesJson = await citiesRes.json();

    const pasig = citiesJson.result?.find(
      (city) =>
        city.name.toLowerCase().includes("pasig") ||
        city.code.toLowerCase().includes("pasig")
    );

    if (!pasig) {
      return res.status(404).json({ error: "Pasig City not found" });
    }

    const reportsRes = await fetch(
      `https://api.mapakalamidad.ph/reports?geoformat=geojson&admin=${pasig.code}`,
      { headers: { "User-Agent": "MyHazardMapApp/1.0" } }
    );

    const reportsData = await reportsRes.json();
    res.json(reportsData.result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// Test routes
// --------------------
app.get("/api/tryserver", (req, res) => {
  res.json({ message: "Server is working!" });
});

app.get("/api/debug-session", (req, res) => {
  res.json({
    session: req.session,
    username: req.session?.username || null,
    userId: req.session?.userId || null,
    role: req.session?.role || null,
  });
});

app.get("/", (req, res) => {
  res.send("ROOT WORKING");
});

// --------------------
// React build (production)
// --------------------
if (process.env.NODE_ENV === "production") {
  const buildPath = path.join(__dirname, "..", "tests", "build");
  app.use(express.static(buildPath));

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(buildPath, "index.html"));
  });
}

// --------------------
// MongoDB
// --------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Atlas connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

mongoose.connection.once("open", async () => {
  console.log("Connected DB:", mongoose.connection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map((c) => c.name));
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');
const fetch = require('node-fetch'); // needed for hazard route
const path = require('path');
const fs = require('fs');

dotenv.config();

// --------------------
// Routes
// --------------------
const userRoutes = require('./routes/userRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const historyRoutes = require('./routes/historyRoutes');
const evacRoutes = require('./routes/EvacRoutes');
const authRoutes = require('./routes/authRoutes');
const barangayRoutes = require('./routes/barangayRoutes');
const drrmoRoutes = require('./routes/drrmoRoutes');
const reliefTrackingRoutes = require('./routes/reliefTrackingRoutes');
const auditRoutes = require('./routes/auditRoutes');
const guidelineRoutes = require("./routes/GuidelineRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const timeInOutRoutes = require('./routes/timeInOutRoutes');
const editRoutes = require('./routes/editRoutes');

const app = express();
app.set('trust proxy', 1);

// --------------------
// Upload folders
// --------------------
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const guidelinesDir = path.join(uploadDir, "guidelines");
if (!fs.existsSync(guidelinesDir)) fs.mkdirSync(guidelinesDir, { recursive: true });

// --------------------
// Body parsers
// --------------------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// IMPORTANT for Render / HTTPS
app.set('trust proxy', 1);

// --------------------
// CORS (merged + FIXED)
// --------------------
const FRONTEND_URLS = [
  'http://localhost:3000',
  'http://localhost:8081',
  'https://sagipbayan.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || FRONTEND_URLS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));

// --------------------
// Session (FIXED for cross-origin)
// --------------------
const isProd = process.env.NODE_ENV === 'production';

app.use(session({
  secret: process.env.SESSION_SECRET || 'supersecretkey',
  resave: false,
  saveUninitialized: false,
  proxy: isProd,
  cookie: {
    secure: isProd,                 // true in Render
    httpOnly: true,
    sameSite: isProd ? 'none' : 'lax', // CRITICAL FIX
    maxAge: 1000 * 60 * 60 * 24
  }
}));

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
    session: req.session
  });
});

// --------------------
// Serve uploads
// --------------------
app.use("/uploads", express.static(uploadDir));
app.use("/uploads/guidelines", express.static(guidelinesDir));

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
app.use('/api/timeinout', timeInOutRoutes);
app.use('/api/edit', editRoutes);

// --------------------
// Hazard proxy (from 2nd file)
// --------------------
app.get("/hazards", async (req, res) => {
  try {
    const citiesRes = await fetch("https://api.mapakalamidad.ph/cities");
    const citiesJson = await citiesRes.json();

    const pasig = citiesJson.result?.find(
      city => city.name.toLowerCase().includes("pasig") || city.code.toLowerCase().includes("pasig")
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
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Atlas connected"))
  .catch(err => console.error("MongoDB connection error:", err));

mongoose.connection.once("open", async () => {
  console.log("Connected DB:", mongoose.connection.name);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log("Collections:", collections.map(c => c.name));
});

// --------------------
// Start server
// --------------------
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

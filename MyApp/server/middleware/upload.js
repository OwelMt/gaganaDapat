const multer = require("multer");
const path = require("path");
const fs = require("fs");

// =======================
// ✅ Local folders
// =======================
const guidelineDir = path.join(__dirname, "../uploads/guidelines");
const proofDir = path.join(__dirname, "../uploads/proofs");

if (!fs.existsSync(guidelineDir)) {
  fs.mkdirSync(guidelineDir, { recursive: true });
}

if (!fs.existsSync(proofDir)) {
  fs.mkdirSync(proofDir, { recursive: true });
}

// =======================
// ✅ Local storage for proofs
// =======================
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Saving proof file to:", proofDir);
    cb(null, proofDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const finalName = `${uniqueSuffix}-${file.originalname}`;
    console.log("Uploading proof file:", file.originalname, "as", finalName);
    cb(null, finalName);
  },
});

// =======================
// ✅ Optional local storage for generic uploads
//    (kept in case you still use `upload` somewhere)
// =======================
const localGuidelineStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log("Saving generic file to:", guidelineDir);
    cb(null, guidelineDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const finalName = `${uniqueSuffix}-${file.originalname}`;
    console.log("Uploading generic file:", file.originalname, "as", finalName);
    cb(null, finalName);
  },
});

// =======================
// ✅ File filters
// =======================
const proofFileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowed.test(ext)) {
    console.log("Proof file accepted:", file.originalname);
    cb(null, true);
  } else {
    cb(new Error("Only images and PDF files are allowed for proofs"), false);
  }
};

const imageOnlyFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image")) {
    return cb(new Error("Only image files are allowed"), false);
  }
  cb(null, true);
};

const allowAllFilter = (req, file, cb) => {
  cb(null, true);
};

// =======================
// ✅ Multer instances
// =======================

// Cloudinary-ready guideline uploader
const uploadGuideline = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: imageOnlyFilter,
});

// Local proof uploader
const uploadProof = multer({
  storage: proofStorage,
  fileFilter: proofFileFilter,
});

// Optional generic local uploader
const upload = multer({
  storage: localGuidelineStorage,
  fileFilter: allowAllFilter,
});

// Cloudinary-ready avatar uploader
const uploadAvatar = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: imageOnlyFilter,
});

// Cloudinary-ready incident image uploader
const uploadIncidentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: imageOnlyFilter,
});

// =======================
// 🛠 Debug helpers
// =======================
uploadGuideline.debugMiddleware = (req, res, next) => {
  console.log("Request files (guideline):", req.files || req.file);
  console.log("Request body (guideline):", req.body);
  next();
};

uploadProof.debugMiddleware = (req, res, next) => {
  console.log("Request files (proof):", req.files || req.file);
  console.log("Request body (proof):", req.body);
  next();
};

upload.debugMiddleware = (req, res, next) => {
  console.log("Request files (generic upload):", req.files || req.file);
  console.log("Request body (generic upload):", req.body);
  next();
};

uploadAvatar.debugMiddleware = (req, res, next) => {
  console.log("Request files (avatar):", req.files || req.file);
  console.log("Request body (avatar):", req.body);
  next();
};

uploadIncidentImage.debugMiddleware = (req, res, next) => {
  console.log("Request files (incident image):", req.files || req.file);
  console.log("Request body (incident image):", req.body);
  next();
};

// =======================
// ✅ Export
// =======================
module.exports = {
  uploadGuideline,
  uploadProof,
  upload,
  uploadAvatar,
  uploadIncidentImage,
};
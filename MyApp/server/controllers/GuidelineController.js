// controllers/GuidelineController.js
const PostingGuideline = require("../models/Guidelines");
const cloudinary = require("../config/cloudinary");

// ✅ Create a new guideline
const createGuideline = async (req, res) => {
  try {
    const files = req.files || [];

    const attachments = await Promise.all(
      files.map(file => {
        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "evacuation_app/guidelines" },
            (err, result) => {
              if (err) return reject(err);

              resolve({
                fileName: file.originalname,
                fileUrl: result.secure_url,
                public_id: result.public_id,
              });
            }
          ).end(file.buffer);
        });
      })
    );

    const guideline = await PostingGuideline.create({
      ...req.body,
      attachments,
    });

    return res.status(201).json(guideline);
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: err.message });
  }
};

// GET /published
const getPublishedGuidelines = async (req, res) => {
  try {
    const guidelines = await PostingGuideline.find({ status: "published" })
      .sort({ priorityLevel: -1, createdAt: -1 });

    res.json(guidelines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// controllers/GuidelineController.js
const incrementViews = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    );
    if (!guideline) return res.status(404).json({ message: "Guideline not found" });
    res.json(guideline);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};


// ✅ Get all guidelines
const getGuidelines = async (req, res) => {
  try {
    const { status, category } = req.query;  // Get query parameters
    const filter = {};  // Initialize filter object

    if (status) filter.status = status;  // Add status filter if provided
    if (category) filter.category = category;  // Add category filter if provided

    // Example database query (replace with your actual database code)
    const guidelines = await PostingGuideline.find(filter);  // Assuming you're using something like MongoDB

    if (!guidelines || guidelines.length === 0) {
      return res.status(404).json({ message: "No guidelines found" });  // Handle no results
    }

    res.status(200).json(guidelines);  // Return the guidelines data as JSON

  } catch (err) {
    console.error("Error fetching guidelines:", err);
    res.status(500).json({ error: err.message });  // Return error response
  }
};

// ✅ Get a single guideline by ID
const getGuidelineById = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id)
      .populate("createdBy", "name email");

    if (!guideline) return res.status(404).json({ message: "Guideline not found" });
    res.json(guideline);
  } catch (err) {
    console.error("Error fetching guideline:", err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Update a guideline
const updateGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id);
    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    // =======================
    // ✅ Handle deleted images
    // =======================
    let remainingAttachments = guideline.attachments || [];

    if (req.body.removeImages) {
      const removeList = JSON.parse(req.body.removeImages);

      // delete from Cloudinary
      await Promise.all(
        removeList.map(img =>
          cloudinary.uploader.destroy(img.public_id)
        )
      );

      // filter out removed images
      remainingAttachments = remainingAttachments.filter(
        img => !removeList.some(r => r.public_id === img.public_id)
      );
    }

    // =======================
    // ✅ Upload new images
    // =======================
    const newAttachments = await Promise.all(
      (req.files || []).map(file => {
        return new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { folder: "evacuation_app/guidelines" },
            (err, result) => {
              if (err) return reject(err);

              resolve({
                fileName: file.originalname,
                fileUrl: result.secure_url,
                public_id: result.public_id,
              });
            }
          ).end(file.buffer);
        });
      })
    );

    // =======================
    // ✅ Combine old + new
    // =======================
    guideline.attachments = [...remainingAttachments, ...newAttachments];

    // =======================
    // ✅ Update other fields
    // =======================
    Object.assign(guideline, req.body);

    await guideline.save();

    res.json(guideline);
  } catch (err) {
    console.error("Error updating guideline:", err);
    res.status(400).json({ error: err.message });
  }
};

//Delete
const deleteGuideline = async (req, res) => {
  try {
    const guideline = await PostingGuideline.findById(req.params.id);

    if (!guideline) {
      return res.status(404).json({ message: "Guideline not found" });
    }

    // ✅ delete images from Cloudinary
    if (guideline.attachments?.length) {
      await Promise.all(
        guideline.attachments.map(file =>
          cloudinary.uploader.destroy(file.public_id)
        )
      );
    }

    await PostingGuideline.findByIdAndDelete(req.params.id);

    res.json({ message: "Guideline deleted successfully" });
  } catch (err) {
    console.error("Error deleting guideline:", err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createGuideline,
  getGuidelines,
  getGuidelineById,
  updateGuideline,
  deleteGuideline,
  incrementViews,
};
const mongoose = require("mongoose");
const slugify = require("slugify");

const PostingGuidelineSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [150, "Title cannot exceed 150 characters"],
    },

    slug: {
      type: String,
      unique: true,
      sparse: true,
    },

    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },

    category: {
      type: String,
      enum: ["earthquake", "flood", "typhoon", "general"],
      required: true,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    priorityLevel: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    attachments: [
      {
        fileName: { type: String, default: "" },
        fileUrl: { type: String, default: "" },
        public_id: { type: String, default: "" },
      },
    ],

    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

PostingGuidelineSchema.pre("save", async function () {
  if (!this.isModified("title") || !this.title) return;

  const baseSlug = slugify(this.title, { lower: true, strict: true });
  let slug = baseSlug;

  const existing = await mongoose.models.Guidelines.findOne({
    slug,
    _id: { $ne: this._id },
  });

  if (existing) {
    slug = `${baseSlug}-${Date.now()}`;
  }

  this.slug = slug;
});

const GuidelinesModel = mongoose.model("Guidelines", PostingGuidelineSchema);

module.exports = GuidelinesModel;
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
    },

    description: {
      type: String,
      required: [true, "Description is required"],
    },

    category: {
      type: String,
      enum: [
        "earthquake",
        "flood",
        "typhoon",
        "general",
      ],
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
        fileName: String,
        fileUrl: String,
        public_id: String, // ✅ REQUIRED
      },
    ],

    isArchived: {
      type: Boolean,
      default: false,
    },

    views: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Auto-generate slug before saving
PostingGuidelineSchema.pre("save", async function () {
  if (!this.isModified("title") || !this.title) return;
  this.slug = slugify(this.title, { lower: true, strict: true });
});



const GuidelinesModel = mongoose.model("Guidelines", PostingGuidelineSchema);

module.exports = GuidelinesModel;
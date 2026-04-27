const mongoose = require('mongoose');

const inventoryItemSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['goods', 'monetary'],
      required: true,
      default: 'goods',
      trim: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    category: {
      type: String,
      required: function () {
        return this.type === 'goods';
      },
      trim: true
    },

    quantity: {
      type: Number,
      required: function () {
        return this.type === 'goods';
      },
      min: 0
    },

    unit: {
      type: String,
      required: function () {
        return this.type === 'goods';
      },
      trim: true
    },

    amount: {
      type: Number,
      required: function () {
        return this.type === 'monetary';
      },
      min: 0
    },

    expirationDate: {
      type: Date,
      default: undefined
    },

    description: {
      type: String,
      trim: true,
      default: ''
    },

    sourceType: {
      type: String,
      enum: ['external', 'government', 'internal'],
      default: 'external',
      trim: true
    },

    sourceName: {
      type: String,
      trim: true,
      default: ''
    },

    proofFiles: {
      type: [String],
      default: []
    },

    addedBy: {
      type: String,
      trim: true,
      default: ''
    },

    isArchive: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// Normalize fields before saving
inventoryItemSchema.pre('validate', function () {
  if (this.category) {
    this.category = this.category.toLowerCase().trim();
  }

  if (this.type === 'goods') {
    this.amount = undefined;
  }

  if (this.type === 'monetary') {
    this.category = undefined;
    this.quantity = undefined;
    this.unit = undefined;
    this.expirationDate = undefined;
  }
});

module.exports = mongoose.model('InventoryItem', inventoryItemSchema);
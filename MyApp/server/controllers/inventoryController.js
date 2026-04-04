const InventoryItem = require('../models/InventoryItem');
const InventoryLog = require('../models/InventoryLog');

const VALID_TYPES = ['goods', 'monetary'];
const VALID_SOURCE_TYPES = ['external', 'government', 'internal'];

const normalizeString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const normalizeLower = (value, fallback) => {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).trim().toLowerCase();
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const validateInventoryData = (body, isUpdate = false, currentType = null) => {
  const errors = [];

  const type = normalizeLower(body.type, currentType || 'goods');
  const name = body.name !== undefined ? normalizeString(body.name) : undefined;
  const category = body.category !== undefined ? normalizeLower(body.category) : undefined;
  const quantity = body.quantity !== undefined ? toNumber(body.quantity) : undefined;
  const unit = body.unit !== undefined ? normalizeString(body.unit) : undefined;
  const amount = body.amount !== undefined ? toNumber(body.amount) : undefined;
  const description = body.description !== undefined ? normalizeString(body.description) : undefined;
  const sourceType = body.sourceType !== undefined
    ? normalizeLower(body.sourceType)
    : undefined;
  const sourceName = body.sourceName !== undefined ? normalizeString(body.sourceName) : undefined;

  if (!VALID_TYPES.includes(type)) {
    errors.push('Invalid type. Must be goods or monetary.');
  }

  if (!isUpdate || body.name !== undefined) {
    if (!name) errors.push('Name is required.');
  }

  if (sourceType !== undefined && !VALID_SOURCE_TYPES.includes(sourceType)) {
    errors.push('Invalid sourceType. Must be external, government, or internal.');
  }

  if (type === 'goods') {
    if (!isUpdate || body.category !== undefined) {
      if (!category) {
        errors.push('Category is required for goods.');
      }
    }

    if (!isUpdate || body.quantity !== undefined) {
      if (quantity === undefined || quantity < 0) {
        errors.push('Quantity is required for goods and must be 0 or higher.');
      }
    }

    if (!isUpdate || body.unit !== undefined) {
      if (!unit) {
        errors.push('Unit is required for goods.');
      }
    }
  }

  if (type === 'monetary') {
    if (!isUpdate || body.amount !== undefined) {
      if (amount === undefined || amount < 0) {
        errors.push('Amount is required for monetary and must be 0 or higher.');
      }
    }
  }

  return {
    errors,
    data: {
      type,
      name,
      category,
      quantity,
      unit,
      amount,
      description,
      sourceType,
      sourceName
    }
  };
};

const createLog = async (item, action, username, remarks = '') => {
  await InventoryLog.create({
    inventoryItem: item._id,
    itemName: item.name,
    itemType: item.type,
    action,
    quantity: item.type === 'goods' ? item.quantity : undefined,
    amount: item.type === 'monetary' ? item.amount : undefined,
    performedBy: username || '',
    remarks
  });
};

// =========================
// ANALYTICS HELPERS
// =========================
const getDateKey = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// =========================
// ANALYTICS CONTROLLERS
// =========================
const getInventorySummary = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false }).lean();

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const summary = items.reduce(
      (acc, item) => {
        acc.totalEntries += 1;

        if (item.type === 'goods') {
          acc.goodsEntries += 1;
          acc.totalGoodsQuantity += Number(item.quantity || 0);
        }

        if (item.type === 'monetary') {
          acc.monetaryEntries += 1;
          acc.totalMonetaryAmount += Number(item.amount || 0);
        }

        if (item.createdAt && new Date(item.createdAt) >= sevenDaysAgo) {
          acc.recentDonations += 1;
        }

        return acc;
      },
      {
        totalEntries: 0,
        goodsEntries: 0,
        monetaryEntries: 0,
        totalGoodsQuantity: 0,
        totalMonetaryAmount: 0,
        recentDonations: 0
      }
    );

    res.json(summary);
  } catch (err) {
    console.error('Get Inventory Summary Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryCategoryStats = async (req, res) => {
  try {
    const items = await InventoryItem.find({
      isArchive: false,
      type: 'goods'
    }).lean();

    const result = {};

items.forEach((item) => {
  const category = String(item.category || '').toLowerCase();

  if (!result[category]) {
    result[category] = 0;
  }

  result[category] += Number(item.quantity || 0);
});

    res.json(result);
  } catch (err) {
    console.error('Get Inventory Category Stats Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const getInventorySourceStats = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false }).lean();

    const result = {
      external: 0,
      government: 0,
      internal: 0
    };

    items.forEach((item) => {
      const sourceType = String(item.sourceType || '').toLowerCase();
      if (result[sourceType] !== undefined) {
        result[sourceType] += 1;
      }
    });

    res.json(result);
  } catch (err) {
    console.error('Get Inventory Source Stats Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryRecentTrend = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false })
      .sort({ createdAt: 1 })
      .lean();

    const now = new Date();
    const start = new Date();
    start.setDate(now.getDate() - 6);

    const dateMap = {};

    for (let i = 0; i < 7; i += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      dateMap[getDateKey(day)] = 0;
    }

    items.forEach((item) => {
      if (!item.createdAt) return;

      const key = getDateKey(item.createdAt);
      if (dateMap[key] !== undefined) {
        dateMap[key] += 1;
      }
    });

    const trend = Object.entries(dateMap).map(([date, count]) => ({
      _id: date,
      count
    }));

    res.json(trend);
  } catch (err) {
    console.error('Get Inventory Recent Trend Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Add new inventory item
const addInventory = async (req, res) => {
  console.log('BODY:', req.body);
  console.log('FILES:', req.files);
  console.log('FILE:', req.file);

  try {
    const username = req.session?.username || '';

    const { errors, data } = validateInventoryData(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    let proofFiles = [];

    if (Array.isArray(req.files)) {
      proofFiles = req.files.map(file => file.filename);
    } else if (req.file) {
      proofFiles = [req.file.filename];
    }

    const itemData = {
      type: data.type,
      name: data.name,
      description: data.description || '',
      sourceType: data.sourceType || 'external',
      sourceName: data.sourceName || '',
      proofFiles,
      addedBy: username,
      isArchive: false
    };

    if (data.type === 'goods') {
      if (data.quantity === undefined || data.quantity <= 0) {
        return res.status(400).json({
          message: 'Quantity must be greater than 0'
        });
      }

      if (!data.unit) {
        return res.status(400).json({
          message: 'Unit is required'
        });
      }

      if (!data.category) {
        return res.status(400).json({
          message: 'Category is required'
        });
      }

      itemData.category = data.category;
      itemData.quantity = data.quantity;
      itemData.unit = data.unit;
    }

    if (data.type === 'monetary') {
      if (data.amount === undefined || data.amount <= 0) {
        return res.status(400).json({
          message: 'Amount must be greater than 0'
        });
      }

      itemData.amount = data.amount;
    }

    console.log('FINAL ITEM DATA:', itemData);

    const item = await InventoryItem.create(itemData);

    try {
      await createLog(item, 'create', username, 'Inventory item created');
    } catch (logErr) {
      console.error('LOG ERROR:', logErr);
    }

    res.status(201).json(item);
  } catch (err) {
    console.error('Add Inventory Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get all active inventory items
const getInventory = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: false }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('Get Inventory Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Update inventory item
const updateInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session?.username || '';

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const finalType = req.body.type
      ? normalizeLower(req.body.type, item.type)
      : item.type;

    const mergedBody = {
      ...req.body,
      type: finalType
    };

    const { errors, data } = validateInventoryData(mergedBody, true, item.type);
    if (errors.length > 0) {
      return res.status(400).json({ message: errors[0], errors });
    }

    if (req.body.name !== undefined) item.name = data.name;
    if (req.body.type !== undefined) item.type = data.type;
    if (req.body.description !== undefined) item.description = data.description;
    if (req.body.sourceType !== undefined) item.sourceType = data.sourceType;
    if (req.body.sourceName !== undefined) item.sourceName = data.sourceName;

    if (item.type === 'goods') {
      if (req.body.category !== undefined) item.category = data.category;
      if (req.body.quantity !== undefined) item.quantity = data.quantity;
      if (req.body.unit !== undefined) item.unit = data.unit;

      item.amount = undefined;
    }

    if (item.type === 'monetary') {
      if (req.body.amount !== undefined) item.amount = data.amount;

      item.category = undefined;
      item.quantity = undefined;
      item.unit = undefined;
    }

    if (req.files && req.files.length > 0) {
      const newFiles = req.files.map(file => file.filename);
      item.proofFiles = [...(item.proofFiles || []), ...newFiles];
    }

    await item.save();

    await createLog(item, 'update', username, 'Inventory item updated');

    res.json(item);
  } catch (err) {
    console.error('Update Inventory Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Soft delete / archive
const deleteInventory = async (req, res) => {
  try {
    const { id } = req.params;
    const username = req.session?.username || '';

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.isArchive = true;
    await item.save();

    await createLog(item, 'archive', username, 'Inventory item archived');

    res.json({
      message: 'Inventory archived successfully',
      item
    });
  } catch (err) {
    console.error('Delete Inventory Error:', err);
    res.status(500).json({ message: err.message });
  }
};

// Get archived inventory
const getArchivedInventory = async (req, res) => {
  try {
    const items = await InventoryItem.find({ isArchive: true }).sort({ updatedAt: -1 });
    res.json(items);
  } catch (err) {
    console.error('Get Archived Inventory Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const unarchiveInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.isArchive = false;
    await item.save();

    res.json({
      message: 'Inventory unarchived successfully',
      item
    });
  } catch (err) {
    console.error('Unarchive Inventory Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const permanentDeleteInventory = async (req, res) => {
  try {
    const { id } = req.params;

    const item = await InventoryItem.findById(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    await InventoryItem.findByIdAndDelete(id);

    res.json({
      message: 'Inventory permanently deleted successfully'
    });
  } catch (err) {
    console.error('Permanent Delete Inventory Error:', err);
    res.status(500).json({ message: err.message });
  }
};

const getInventoryCategories = async (req, res) => {
  try {
    const categories = await InventoryItem.distinct('category', {
      isArchive: false,
      type: 'goods'
    });

    res.json(categories.sort());
  } catch (err) {
    console.error('Get Categories Error:', err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  addInventory,
  getInventory,
  updateInventory,
  deleteInventory,
  getArchivedInventory,
  unarchiveInventory,
  permanentDeleteInventory,
  getInventorySummary,
  getInventoryCategoryStats,
  getInventorySourceStats,
  getInventoryRecentTrend,
  getInventoryCategories
};
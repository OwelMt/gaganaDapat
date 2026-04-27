const bcrypt = require('bcryptjs');
const User = require('../models/UserStaff.js');
const Barangay = require('../models/Barangay.js');
const ArchivedAccount = require('../models/ArchivedAccount.js');
const TimeLog = require('../models/TimeLog');
const AdminLog = require('../models/AdminLog');
const UserStaff = require('../models/UserStaff.js');

const BARANGAY_OPTIONS = [
  "Calabasa",
  "Don Mariano Marcos",
  "Dampulan",
  "Hilera",
  "Imbunia",
  "Lambakin",
  "Langla",
  "Magsalisi",
  "Malabon Kaingin",
  "Marawa",
  "Niyugan",
  "Pamacpacan",
  "Pakol",
  "Pinanggaan",
  "Putlod",
  "San Jose",
  "San Josef (Nabao)",
  "San Pablo",
  "San Roque",
  "San Vicente",
  "Santa Rita",
  "Sapang",
  "Santo Tomas North",
  "Santo Tomas South",
  "Ulanin Pitak"
];

/* INIT ADMIN */
const initAdmin = async (req, res) => {
  try {

    const admin = await User.findOne({ role: 'admin' });

    if (!admin) {

      const hashed = await bcrypt.hash('admin123', 10);

      await User.create({
        username: 'admin',
        email: 'admin@drrmo.gov.ph',
        password: hashed,
        role: 'admin',
        verified: true,
        phoneNumber: '0000000000',
        address: 'DRRMO Main Office'
      });

    }

    res.send('Admin ready');

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


/* REGISTER */
const register = async (req, res) => {
  try {
    const {
      role,
      email,
      password,
      username,
      barangay,
      phoneNumber,
      hotline,
      address
    } = req.body;

    if (!role || !password || !username || !phoneNumber || !address) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    /* BARANGAY ACCOUNT */
    if (role === 'barangay') {
      if (!email || !barangay) {
        return res.status(400).json({ message: 'Missing barangay details' });
      }

      const normalizedBarangay = String(barangay).trim();

      if (!BARANGAY_OPTIONS.includes(normalizedBarangay)) {
        return res.status(400).json({ message: 'Invalid barangay selected' });
      }

      const existingEmail = await Barangay.findOne({ email });

      if (existingEmail) {
        return res.status(400).json({ message: 'Barangay email already exists' });
      }

      const existingBarangay = await Barangay.findOne({
        barangayName: normalizedBarangay,
        archived: false
      });

      if (existingBarangay) {
        return res.status(400).json({
          message: 'An active account for this barangay already exists'
        });
      }

      const barangayUser = await Barangay.create({
        username,
        email,
        password: hashedPassword,
        barangayName: normalizedBarangay,
        verified: true,
        phoneNumber,
        hotline,
        address
      });

      await AdminLog.create({
        adminId: req.session.userId,
        adminUsername: req.session.username,
        action: "create",
        targetUserId: barangayUser._id,
        targetUsername: barangayUser.username,
        barangay: barangayUser.barangayName
      });

      return res.json({
        username: barangayUser.username,
        email: barangayUser.email,
        barangay: barangayUser.barangayName,
        role: 'barangay',
        verified: barangayUser.verified,
        phoneNumber,
        hotline,
        address
      });
    }

    /* ADMIN / DRRMO ACCOUNT */
    if (!email) {
      return res.status(400).json({ message: 'Email required' });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      role,
      verified: true,
      phoneNumber,
      hotline,
      address
    });

    await AdminLog.create({
      adminId: req.session.userId,
      adminUsername: req.session.username,
      action: "create",
      targetUserId: user._id,
      targetUsername: user.username
    });

    res.json({
      username: user.username,
      email: user.email,
      role: user.role,
      verified: user.verified,
      phoneNumber,
      hotline,
      address
    });
  } catch (err) {
    console.error(err);

    if (err.code === 11000 && err.keyPattern?.barangayName) {
      return res.status(400).json({
        message: 'An active account for this barangay already exists'
      });
    }

    if (err.code === 11000 && err.keyPattern?.email) {
      return res.status(400).json({
        message: 'Email already exists'
      });
    }

    res.status(500).json({ message: err.message });
  }
};


/* LOGIN */
const login = async (req, res) => {

  try {

    const { email, password } = req.body;

    let account = await UserStaff.findOne({ email });
    let role = account ? account.role : null;
    let barangayName = null;

    if (!account) {

      account = await Barangay.findOne({ email });

      if (account) {
        role = 'barangay';
        barangayName = account.barangayName;
      }

    }

    if (!account)
      return res.status(401).json({ message: 'Invalid email or password' });

    const match = await bcrypt.compare(password, account.password);

    if (!match)
      return res.status(401).json({ message: 'Invalid email or password' });

console.log("LOGIN ACCOUNT:", {
  id: account._id,
  email: account.email,
  username: account.username,
  role
});

req.session.userId = account._id;
req.session.role = role;
req.session.isAuthenticated = true;
req.session.username = account.username;
req.session.barangayName = barangayName || account.barangayName || "";

console.log("SESSION BEFORE SAVE:", req.session);


   req.session.save(async (err) => {
  if (err) {
    return res.status(500).json({ message: "Session save failed" });
  }

  await TimeLog.create({
    user: account._id,
    userModel: role === 'barangay' ? 'Barangay' : 'UserStaff',
    username: account.username,
    role,
    barangay: barangayName,
    timeIn: new Date(),
    timeOut: null
  });

  res.json({
    username: account.username,
    email: account.email,
    role,
    verified: account.verified,
    ...(role === 'barangay' && { barangay: barangayName })
  });
});

  } catch (err) {

    res.status(500).json({ message: err.message });

  }
};


/* LOGOUT */
const logout = async (req, res) => {

  try {

    if (!req.session.userId) {
      return res.json({ message: 'No active session' });
    }

    await TimeLog.findOneAndUpdate(
      { user: req.session.userId, timeOut: null },
      { timeOut: new Date() },
      { sort: { timeIn: -1 } }
    );

    req.session.destroy(() => {
      res.json({ message: 'Logged out successfully' });
    });

  } catch (err) {

    res.status(500).json({ message: err.message });

  }
};


/* GET ALL ACCOUNTS */
const getAllAccounts = async (req, res) => {

  try {

    const users = await User.find({ archived: false }).select('-password');
    const barangays = await Barangay.find().select('-password');

    const all = [

      ...users.map(u => ({
        ...u.toObject(),
        type: 'user'
      })),

      ...barangays.map(b => ({
        ...b.toObject(),
        role: 'barangay',
        type: 'barangay'
      }))

    ];

    res.json(all);

  } catch (err) {

    res.status(500).json({ message: err.message });

  }
};


/* UPDATE ACCOUNT */
const updateAccount = async (req, res) => {

  try {

    const targetId = req.params.id || req.session.userId;

    let account =
      await Barangay.findById(targetId) ||
      await User.findById(targetId);

    if (!account)
      return res.status(404).json({ message: 'Account not found' });

    const { username, email, phoneNumber, hotline, address, password } = req.body;

    if (username !== undefined) account.username = username;
    if (email !== undefined) account.email = email;
    if (phoneNumber !== undefined) account.phoneNumber = phoneNumber;
    if (hotline !== undefined) account.hotline = hotline;
    if (address !== undefined) account.address = address;

    if (password) {

      const same = await bcrypt.compare(password, account.password);

      if (same)
        return res.status(400).json({ message: 'Password must be different' });

      account.password = await bcrypt.hash(password, 10);

    }

    await account.save();

    await AdminLog.create({
      adminId: req.session.userId,
      adminUsername: req.session.username,
      action: "update",
      targetUserId: account._id,
      targetUsername: account.username
    });

    res.json(account);

  } catch (err) {

    res.status(500).json({ message: err.message });

  }
};


/* ARCHIVE ACCOUNT */
const archiveAccount = async (req, res) => {

  try {

    const accountId = req.params.id;

    let account = await User.findById(accountId);
    let accountType = "User";
    let role = account ? account.role : null;

    if (!account) {

      account = await Barangay.findById(accountId);
      accountType = "Barangay";
      role = "barangay";

    }

    if (!account)
      return res.status(404).json({ message: "Account not found" });

    await ArchivedAccount.create({

      originalId: account._id,
      accountType,
      role,
      username: account.username,
      email: account.email,
      password: account.password,
      barangayName: account.barangayName,
      phoneNumber: account.phoneNumber,
      hotline: account.hotline,
      address: account.address

    });

    await account.deleteOne();

    await AdminLog.create({
      adminId: req.session.userId,
      adminUsername: req.session.username,
      action: "archive",
      targetUserId: account._id,
      targetUsername: account.username
    });

    res.json({ message: "Account archived successfully" });

  } catch (err) {

    console.error(err);
    res.status(500).json({ message: err.message });

  }

};


/* RESTORE ACCOUNT */
const restoreAccount = async (req, res) => {

  try {

    const archiveId = req.params.id;

    const archived = await ArchivedAccount.findById(archiveId);

    if (!archived)
      return res.status(404).json({ message: "Archived account not found" });

    let restored;

    if (archived.accountType === "User") {

      restored = await User.create({

        username: archived.username,
        email: archived.email,
        password: archived.password,
        phoneNumber: archived.phoneNumber,
        hotline: archived.hotline,
        address: archived.address,
        role: archived.role   // FIXED HERE

      });

    } else {

      restored = await Barangay.create({

        username: archived.username,
        email: archived.email,
        password: archived.password,
        phoneNumber: archived.phoneNumber,
        hotline: archived.hotline,
        address: archived.address,
        barangayName: archived.barangayName,
        verified: true

      });

    }

    await archived.deleteOne();

    await AdminLog.create({

      adminId: req.session.userId,
      adminUsername: req.session.username,
      action: "restore",
      targetUserId: restored._id,
      targetUsername: restored.username

    });

    res.json({
      message: "Account restored successfully",
      restored
    });

  } catch (err) {

    console.error(err);
    res.status(500).json({ message: err.message });

  }

};


/* GET ARCHIVED ACCOUNTS */
const getArchivedAccounts = async (req, res) => {

  try {

    const archived = await ArchivedAccount.find();

    res.json(archived);

  } catch (err) {

    res.status(500).json({ message: err.message });

  }
};


/* ADMIN LOGS */
const getAdminLogs = async (req, res) => {

  try {

    const logs = await AdminLog
      .find()
      .sort({ timestamp: -1 })
      .limit(100);

    res.json(logs);

  } catch (err) {

    res.status(500).json({ message: err.message });

  }
};

const getAvailableBarangays = async (req, res) => {
  try {
    const BARANGAY_OPTIONS = [
      "Calabasa",
  "Don Mariano Marcos",
  "Dampulan",
  "Hilera",
  "Imbunia",
  "Lambakin",
  "Langla",
  "Magsalisi",
  "Malabon Kaingin",
  "Marawa",
  "Niyugan",
  "Pamacpacan",
  "Pakol",
  "Pinanggaan",
  "Putlod",
  "San Jose",
  "San Josef (Nabao)",
  "San Pablo",
  "San Roque",
  "San Vicente",
  "Santa Rita",
  "Sapang",
  "Santo Tomas North",
  "Santo Tomas South",
  "Ulanin Pitak"
    ];

    const existingBarangays = await Barangay.find(
      { archived: false },
      'barangayName'
    ).lean();

    const usedBarangays = existingBarangays.map(item => item.barangayName);

    const availableBarangays = BARANGAY_OPTIONS.filter(
      name => !usedBarangays.includes(name)
    );

    res.json({
      all: BARANGAY_OPTIONS,
      used: usedBarangays,
      available: availableBarangays
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


module.exports = {

  initAdmin,
  register,
  login,
  logout,
  getAllAccounts,
  updateAccount,
  archiveAccount,
  restoreAccount,
  getArchivedAccounts,
  getAdminLogs,
  getAvailableBarangays

};

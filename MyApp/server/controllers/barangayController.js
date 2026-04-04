const Barangay = require("../models/Barangay");
const User = require("../models/User");

const clean = (value) => String(value || "").replace(/<[^>]*>?/gm, "").trim();

/* GET LOGGED-IN BARANGAY / ACCOUNT */
const getMe = async (req, res) => {
  try {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    let account = await Barangay.findById(req.session.userId).select("-password");

    if (account) {
      return res.json({
        ...account.toObject(),
        role: "barangay",
      });
    }

    account = await User.findById(req.session.userId).select("-password");
    if (account) {
      return res.json(account);
    }

    return res.status(404).json({ message: "Account not found" });
  } catch (err) {
    console.error("Get Me Error:", err);
    res.status(500).json({ message: err.message });
  }
};

/* GET BARANGAYS (ROLE-AWARE, DROPDOWN-FRIENDLY) */
const getBarangays = async (req, res) => {
  try {
    const role = req.session?.role;
    const userId = req.session?.userId;
    const sessionBarangayName = clean(
      req.session?.barangayName || req.session?.username
    );

    let query = { archived: false };

    // Barangay users should only receive their own barangay
    if (role === "barangay") {
      query.$or = [];

      if (userId) {
        query.$or.push({ _id: userId });
      }

      if (sessionBarangayName) {
        query.$or.push({ barangayName: sessionBarangayName });
        query.$or.push({ username: sessionBarangayName });
      }

      if (query.$or.length === 0) {
        delete query.$or;
      }
    }

    const barangays = await Barangay.find(query)
      .select("_id barangayName username email")
      .sort({ barangayName: 1 })
      .lean();

    const normalized = barangays.map((item) => ({
      _id: String(item._id),
      name: clean(item.barangayName),
      barangayName: clean(item.barangayName),
      username: clean(item.username),
      email: clean(item.email),
    }));

    res.json(normalized);
  } catch (err) {
    console.error("Get Barangays Error:", err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMe,
  getBarangays,
};
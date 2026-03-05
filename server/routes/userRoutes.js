const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

/* ==============================
   REGISTER
============================== */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log(`\n📝 Register attempt: ${email}`);

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields are required" });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      console.log(`⚠️ User already exists: ${email}`);
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // Create new user
    const user = await User.create({ name, email, password });
    console.log(`✓ User created: ${user._id}`);

    // Generate token
    const token = generateToken(user._id);
    console.log(`✓ Token generated for: ${email}`);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });

    console.log(`✓ Registration successful: ${email}\n`);
  } catch (err) {
    console.error(`✗ Registration error: ${err.message}\n`);
    res.status(500).json({ error: "Registration failed" });
  }
});

/* ==============================
   LOGIN
============================== */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`\n🔐 Login attempt: ${email}`);

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email
    const user = await User.findOne({ email });

    if (!user) {
      console.log(`⚠️ User not found: ${email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Check password
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      console.log(`⚠️ Invalid password for: ${email}`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    console.log(`✓ Password matched for: ${email}`);

    // Generate token
    const token = generateToken(user._id);
    console.log(`✓ Token generated for: ${email}`);

    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token,
    });

    console.log(`✓ Login successful: ${email}\n`);
  } catch (err) {
    console.error(`✗ Login error: ${err.message}\n`);
    res.status(500).json({ error: "Login failed" });
  }
});

/* ==============================
   UNIFIED AUTH ENDPOINT
   POST /auth - Smart auto-login/register
============================== */
router.post("/", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    console.log(`\n🔄 Unified auth attempt: ${email}`);

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists - LOGIN
      console.log(`✓ User found - attempting login`);

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        console.log(`⚠️ Invalid password for: ${email}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken(user._id);
      console.log(`✓ Login successful: ${email}`);

      return res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token,
      });
    } else {
      // User doesn't exist - REGISTER (if name provided)
      console.log(`✓ User not found - attempting register`);

      if (!name) {
        return res.status(400).json({ error: "Name required for registration" });
      }

      user = await User.create({ name, email, password });
      console.log(`✓ User created during auth: ${user._id}`);

      const token = generateToken(user._id);
      console.log(`✓ Registration successful: ${email}`);

      return res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token,
      });
    }
  } catch (err) {
    console.error(`✗ Unified auth error: ${err.message}\n`);
    res.status(500).json({ error: "Authentication failed" });
  }
});

/* ==============================
   PROTECTED PROFILE
============================== */
router.get("/profile", protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`✓ Profile accessed: ${user.email}`);

    res.json({
      message: "Profile accessed successfully",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (err) {
    console.error(`✗ Profile error: ${err.message}`);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

module.exports = router;
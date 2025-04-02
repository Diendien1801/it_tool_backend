const { loginUser } = require("../services/UserService");
const {
  getUserByUsername,
  createUser,
} = require("../repositories/UserRepository");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();




const register = async (req, res) => {
  try {
    console.log("[DEBUG] Register request received:", req.body);

    const { username, password, role } = req.body;

    if (!username || !password) {
      console.log("[DEBUG] Missing username or password");
      return res
        .status(400)
        .json({ success: false, message: "Missing username or password" });
    }

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      console.log(`[DEBUG] Username "${username}" already exists`);
      return res
        .status(400)
        .json({ success: false, message: "Username already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("[DEBUG] Password hashed successfully");

    await createUser(username, hashedPassword, role || "user");
    console.log("[DEBUG] User created successfully");

    res.json({ success: true, message: "User registered successfully" });
  } catch (error) {
    console.error("[ERROR] Register failed:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
  }
};



const login = async (req, res) => {
  try {
    console.log("[DEBUG] Login request received:", req.body);

    const { username, password } = req.body;

    if (!username || !password) {
      console.log("[DEBUG] Missing username or password");
      return res
        .status(400)
        .json({ success: false, message: "Missing username or password" });
    }

    const result = await loginUser(username, password);
    console.log("[DEBUG] Login result:", result);

    if (!result.success) {
      console.log(
        `[DEBUG] Login failed for user "${username}":`,
        result.message
      );
      return res.status(400).json(result);
    }

    console.log(`[DEBUG] Login successful for user "${username}"`);
    res.json(result);
  } catch (error) {
    console.error("[ERROR] Login failed:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
  }
};


module.exports = { register, login };

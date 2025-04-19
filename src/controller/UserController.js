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

    const { username, password, role, level } = req.body;

    if (!username || !password) {
      console.log("[DEBUG] Missing username or password");
      return res.status(400).json({
        success: false,
        data: null,
        message: "Missing username or password",
      });
    }

    // Validate username (Phải là email hợp lệ)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "Invalid email format",
      });
    }

    // Validate password (8+ ký tự, có chữ hoa, chữ thường, số, ký tự đặc biệt)
    const passwordRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        data: null,
        message:
          "Password must be at least 8 characters, including uppercase, lowercase, number, and special character",
      });
    }

    const existingUser = await getUserByUsername(username);
    if (existingUser) {
      console.log(`[DEBUG] Username "${username}" already exists`);
      return res.status(400).json({
        success: false,
        data: null,
        message: "Username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("[DEBUG] Password hashed successfully");

    const newUser = await createUser(
      username,
      hashedPassword,
      role || "user",
      level || "membership"
    );
    console.log("[DEBUG] User created successfully");

    res.json({
      success: true,
      data: newUser,
      message: "User registered successfully",
    });
  } catch (error) {
    console.error("[ERROR] Register failed:", error);
    res.status(500).json({
      success: false,
      data: null,
      message: "Internal server error",
    });
  }
};

const login = async (req, res) => {
  try {
    console.log("[DEBUG] Login request received:", req.body);

    const { username, password } = req.body;

    if (!username || !password) {
      console.log("[DEBUG] Missing username or password");
      return res.status(400).json({
        success: false,
        data: null,
        message: "Missing username or password",
      });
    }

    // Validate username (Phải là email hợp lệ)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(username)) {
      return res.status(400).json({
        success: false,
        data: null,
        message: "Invalid email format",
      });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      console.log(`[DEBUG] No account found for "${username}"`);
      return res.status(400).json({
        success: false,
        data: null,
        message: "Invalid email or password",
      });
    }

    // Kiểm tra password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log(`[DEBUG] Incorrect password for user "${username}"`);
      return res.status(400).json({
        success: false,
        data: null,
        message: "Invalid email or password",
      });
    }

    // Tạo JWT Token
    const token = jwt.sign({ idUser: user.idUser }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    console.log(`[DEBUG] Login successful for "${username}"`);

    res.json({
      success: true,
      data: token,
      message: "Login successful",
    });
  } catch (error) {
    console.error("[ERROR] Login failed:", error);
    res.status(500).json({
      success: false,
      data: null,
      message: "Internal server error",
      error: error.message,
    });
  }
};

const logout = async (req, res) => {
  try {
    console.log("[DEBUG] Logout request received");

    // Xóa token trên client (thực hiện ở phía client)
    // Có thể thêm logic để xóa token khỏi server nếu cần

    res.json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("[ERROR] Logout failed:", error);
    res.status(500).json({
      success: false,
      data: null,
      message: "Internal server error",
    });
  }
}

module.exports = { register, login };

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { poolPromise } = require("./src/config/db"); // Kết nối SQL Server
const userRoutes = require("./src/routes/userRoutes"); // Route đăng ký & đăng nhập
const toolTypesRoutes = require("./src/routes/tool");
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Kiểm tra kết nối database
poolPromise
  .then(() => console.log("✅ Connected to SQL Server"))
  .catch((err) => console.error("❌ Database connection failed", err));

// Routes
// Authentication
app.use("/api/auth", userRoutes);
// ToolTypes
app.use("/api/tool", toolTypesRoutes);
// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

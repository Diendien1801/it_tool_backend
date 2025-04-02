const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const {
  getUserByUsername,
  createUser,
} = require("../repositories/UserRepository");



const loginUser = async (username, password) => {
  // 🔹 Tìm user trong database
  const user = await getUserByUsername(username);
  if (!user) {
    return { success: false, message: "Invalid username or password" };
  }

  // 🔹 So sánh mật khẩu
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return { success: false, message: "Invalid username or password" };
  }

  // 🔹 Tạo token
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );

  // 🔹 Trả về theo format BaseResponse<T>
  return {
    success: true,
    message: "Login successful",
    data: token, // Đặt token trong `data`
  };
};

module.exports = { loginUser };

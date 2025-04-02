const { sql, poolPromise } = require("../config/db");
const { v4: uuidv4 } = require("uuid"); // Import thư viện UUID


const getUserByUsername = async (username) => {
  const pool = await poolPromise;
  const result = await pool
    .request()
    .input("username", sql.NVarChar, username)
    .query("SELECT * FROM Users WHERE username = @username");

  return result.recordset[0]; // Trả về user nếu tìm thấy
};

const createUser = async (username, hashedPassword, role) => {
  const pool = await poolPromise;
  const userId = uuidv4(); // Tạo UUID mới

  await pool
    .request()
    .input("idUser", sql.VarChar(50), userId) // Sử dụng varchar(50) thay vì UniqueIdentifier
    .input("username", sql.NVarChar(50), username)
    .input("password", sql.NVarChar(255), hashedPassword)
    .input("role", sql.NVarChar(20), role)
    .input("createAt", sql.DateTime, new Date()) // Thêm ngày tạo tài khoản
    .query(`
      INSERT INTO Users (idUser, username, password, role, createAt)
      VALUES (@idUser, @username, @password, @role, @createAt)
    `);

  return { idUser: userId, username, role };
};

module.exports = { getUserByUsername, createUser };

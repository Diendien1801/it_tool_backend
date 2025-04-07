const { sql, poolPromise } = require("../config/db");
const jwt = require("jsonwebtoken"); // Import jwt
const JWT_SECRET = process.env.JWT_SECRET; // Lấy secret từ biến môi trường
const bcrypt = require("bcrypt"); // Import bcrypt

// Hàm giải mã token để lấy idUser
const getUserIdFromToken = (req) => {
  try {
    console.log("[DEBUG] Bắt đầu lấy idUser từ token");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error("[ERROR] Không tìm thấy Authorization Header");
      throw new Error("Không tìm thấy Authorization Header");
    }

    console.log(`[DEBUG] Authorization Header: ${authHeader}`);

    const token = authHeader.split(" ")[1]; // Lấy token từ chuỗi "Bearer <token>"
    if (!token) {
      console.error("[ERROR] Không tìm thấy token trong Header");
      throw new Error("Không tìm thấy token");
    }

    console.log(`[DEBUG] Token nhận được: ${token}`);

    const decoded = jwt.verify(token, JWT_SECRET); // Giải mã token
    console.log(`[DEBUG] Token được giải mã:`, decoded);

    if (!decoded.idUser) {
      console.error("[ERROR] idUser không tồn tại trong token");
      throw new Error("idUser không tồn tại trong token");
    }

    console.log(`[DEBUG] idUser lấy được: ${decoded.idUser}`);
    return decoded.idUser;
  } catch (error) {
    console.error(`[ERROR] Lỗi khi lấy idUser từ token: ${error.message}`);
    throw error; // Ném lỗi để xử lý tiếp trong middleware/controller
  }
};

// Lấy thông tin tài khoản
const getAccountInfo = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    console.log(`[DEBUG] Lấy thông tin user với idUser: ${idUser}`);

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query(
        "SELECT idUser, username, role, level, createAt FROM Users WHERE idUser = @idUser"
      );

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
        data: null,
      });
    }

    console.log(`[DEBUG] Thông tin user:`, result.recordset[0]);
    res.json({
      success: true,
      data: result.recordset[0],
      message: "Lấy thông tin tài khoản thành công",
    });
  } catch (error) {
    console.error("[ERROR] Lỗi khi lấy thông tin tài khoản:", error);
    res.status(401).json({
      success: false,
      message: "Lỗi xác thực hoặc lấy thông tin tài khoản",
      error: error.message,
      data: null,
    });
  }
};

// Lấy danh sách tool yêu thích
const getFavouriteTools = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    console.log(
      `🔍 [DEBUG] Lấy danh sách tool yêu thích cho idUser: ${idUser}`
    );

    const pool = await poolPromise;
    const query = `
      SELECT T.idTool, T.name, T.descript, T.status, T.access_level, T.iconURL, T.idToolType, T.dllPath
      FROM FavouriteTools FT
      JOIN Tools T ON FT.idTool = T.idTool
      WHERE FT.idUser = @idUser
    `;

    const result = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query(query);

    console.log("📦 [DEBUG] Kết quả truy vấn:", result.recordset);
    res.json({
      success: true,
      data: result.recordset,
      message: "Lấy danh sách tool yêu thích thành công",
    });
  } catch (error) {
    console.error("❌ [ERROR] Lỗi khi lấy danh sách tool yêu thích:", error);
    res.status(500).json({
      success: false,
      data: null,
      message: "Lỗi khi lấy danh sách tool yêu thích",
      error: error.message,
    });
  }
};

// Thêm tool yêu thích
const addFavouriteTool = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    const { idTool } = req.body;
    console.log("Thêm tool yêu thích:", idUser, idTool);

    const pool = await poolPromise;

    // Kiểm tra xem tool đã tồn tại trong danh sách yêu thích chưa
    const checkQuery = `SELECT * FROM FavouriteTools WHERE idUser = @idUser AND idTool = @idTool`;
    const checkResult = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .input("idTool", sql.VarChar(50), idTool)
      .query(checkQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Tool đã tồn tại trong danh sách yêu thích",
        data: null,
      });
    }

    // Thêm tool vào danh sách yêu thích
    const insertQuery = `INSERT INTO FavouriteTools (idUser, idTool) VALUES (@idUser, @idTool)`;
    await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .input("idTool", sql.VarChar(50), idTool)
      .query(insertQuery);

    res.json({
      success: true,
      message: "Thêm tool vào danh sách yêu thích thành công",
    });
  } catch (error) {
    console.error("Lỗi khi thêm tool vào danh sách yêu thích:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm tool vào danh sách yêu thích",
      data: null,
      error: error.message,
    });
  }
};

// Xóa tool yêu thích
const removeFavouriteTool = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    const { idTool } = req.body;
    console.log("Xóa tool yêu thích:", idUser, idTool);

    const pool = await poolPromise;

    // Xóa tool khỏi danh sách yêu thích
    const deleteQuery = `DELETE FROM FavouriteTools WHERE idUser = @idUser AND idTool = @idTool`;
    await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .input("idTool", sql.VarChar(50), idTool)
      .query(deleteQuery);

    res.json({
      success: true,
      message: "Xóa tool khỏi danh sách yêu thích thành công",
    });
  } catch (error) {
    console.error("Lỗi khi xóa tool khỏi danh sách yêu thích:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi xóa tool khỏi danh sách yêu thích",
      data: null,
      error: error.message,
    });
  }
};

// xin nâng cấp tài khoản lên premium
const requestUpgradeAccount = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    console.log(`[DEBUG] Gửi yêu cầu nâng cấp cho idUser: ${idUser}`);

    const pool = await poolPromise;

    // 1. Lấy thông tin level hiện tại
    const userResult = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT level FROM Users WHERE idUser = @idUser");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const currentLevel = userResult.recordset[0].level;
    console.log(`[DEBUG] Level hiện tại: ${currentLevel}`);

    // 2. Nếu đã là premium thì không cần nâng cấp nữa
    if (currentLevel === "premium") {
      return res.status(400).json({
        success: false,
        message: "Tài khoản của bạn đã ở mức cao nhất (premium)",
      });
    }

    // 3. Kiểm tra yêu cầu nâng cấp gần nhất
    const checkRequest = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser).query(`
        SELECT TOP 1 * FROM UpgradeRequests 
        WHERE idUser = @idUser 
        ORDER BY createdAt DESC
      `);

    if (checkRequest.recordset.length > 0) {
      const lastRequest = checkRequest.recordset[0];
      const { status } = lastRequest;

      if (status === "pending") {
        return res.status(400).json({
          success: false,
          message: "Bạn đã gửi yêu cầu nâng cấp và đang chờ xử lý.",
        });
      }

      if (status === "rejected") {
        return res.status(400).json({
          success: false,
          message: "Yêu cầu nâng cấp của bạn đã bị từ chối.",
        });
      }

      if (status === "accepted") {
        return res.status(400).json({
          success: false,
          message: "Tài khoản của bạn đã được nâng cấp.",
        });
      }
    }

    // 4. Chèn yêu cầu mới (status = 'pending', createdAt = GETDATE())
    const insertQuery = `
      INSERT INTO UpgradeRequests (idUser, status, createdAt)
      VALUES (@idUser, 'pending', GETDATE())
    `;

    await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query(insertQuery);

    res.json({
      success: true,
      message: "Gửi yêu cầu nâng cấp thành công. Vui lòng chờ duyệt.",
    });
  } catch (error) {
    console.error("❌ [ERROR] Gửi yêu cầu nâng cấp lỗi:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi gửi yêu cầu nâng cấp tài khoản",
      error: error.message,
    });
  }
};

module.exports = {
  getAccountInfo,
  getFavouriteTools,
  addFavouriteTool,
  removeFavouriteTool,
  requestUpgradeAccount,
};

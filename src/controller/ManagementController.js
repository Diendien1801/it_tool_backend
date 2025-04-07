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

// Lấy danh sách các yêu cầu nâng cấp nếu là admin
const getAllUpgradeRequests = async (req, res) => {
  try {
    console.log("[DEBUG] Nhận request GET /upgrade-requests");
    const idUser = getUserIdFromToken(req);
    console.log(`[DEBUG] idUser xác thực: ${idUser}`);

    const pool = await poolPromise;
    console.log("[DEBUG] Đã kết nối tới database");

    const checkRoleQuery = "SELECT role FROM Users WHERE idUser = @idUser";
    console.log(`[DEBUG] Thực hiện truy vấn kiểm tra role: ${checkRoleQuery}`);

    const checkRoleResult = await pool
      .request()
      .input("idUser", sql.NVarChar, idUser)
      .query(checkRoleQuery);

    const role = checkRoleResult.recordset[0]?.role;
    console.log(`[DEBUG] Role người dùng: ${role}`);

    if (role !== "admin") {
      console.warn("[WARN] Người dùng không phải admin, từ chối truy cập");
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập chức năng này",
      });
    }

    console.log("[DEBUG] Người dùng là admin, tiếp tục lấy danh sách yêu cầu");

    const upgradeQuery = `
        SELECT 
            r.idRequest,
            r.idUser,
            u.username,
            u.level,
            r.status,
            r.createdAt,
            r.handledAt
        FROM UpgradeRequests r
        JOIN Users u ON r.idUser = u.idUser
        WHERE r.status = 'pending'
        ORDER BY r.createdAt DESC
    `;
    console.log(`[DEBUG] Thực hiện truy vấn lấy danh sách yêu cầu: ${upgradeQuery}`);

    const result = await pool.request().query(upgradeQuery);
    console.log(`[DEBUG] Số lượng yêu cầu lấy được: ${result.recordset.length}`);

    res.json({
      success: true,
      message: "Lấy danh sách yêu cầu thành công",
      data: result.recordset,
    });
  } catch (error) {
    console.error("[ERROR] Lỗi khi lấy danh sách yêu cầu:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};


// accept upgrade request
const acceptUpgradeRequest = async (req, res) => {
  try {
    console.log("[DEBUG] Bắt đầu xử lý Accept Request");

    const { idRequest } = req.body;
    if (!idRequest) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu idRequest" });
    }

    const idAdmin = getUserIdFromToken(req); // Giải mã token để lấy idUser
    const pool = await poolPromise;

    // Kiểm tra role của user
    const checkRoleResult = await pool
      .request()
      .input("idUser", sql.NVarChar, idAdmin)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    const role = checkRoleResult.recordset[0]?.role;
    console.log(`[DEBUG] Vai trò người dùng: ${role}`);

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    // Lấy idUser của người gửi request từ bảng UpgradeRequests
    const requestResult = await pool
      .request()
      .input("idRequest", sql.UniqueIdentifier, idRequest)
      .query("SELECT idUser FROM UpgradeRequests WHERE idRequest = @idRequest");

    if (requestResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy yêu cầu nâng cấp" });
    }

    const idUserToUpgrade = requestResult.recordset[0].idUser;
    console.log(`[DEBUG] Upgrade cho user: ${idUserToUpgrade}`);

    // Cập nhật trạng thái yêu cầu & cập nhật level người dùng
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    // Cập nhật bảng yêu cầu
    await request.input("idRequest", sql.UniqueIdentifier, idRequest).query(`
        UPDATE UpgradeRequests
        SET status = 'approved', handledAt = GETDATE()
        WHERE idRequest = @idRequest
      `);

    // Cập nhật level user (ở đây gán 'premium', bạn có thể thay thành gì tùy ý)
    await request.input("idUser", sql.NVarChar, idUserToUpgrade).query(`
        UPDATE Users
        SET level = 'premium'
        WHERE idUser = @idUser
      `);

    await transaction.commit();

    console.log("[DEBUG] Đã cập nhật thành công yêu cầu và người dùng");
    res.json({
      success: true,
      message: "Đã chấp nhận yêu cầu nâng cấp tài khoản",
    });
  } catch (error) {
    console.error("[ERROR] Lỗi khi chấp nhận yêu cầu:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};
const rejectUpgradeRequest = async (req, res) => {
  try {
    console.log("[DEBUG] Bắt đầu xử lý Reject Request");

    const { idRequest } = req.body;
    if (!idRequest) {
      return res
        .status(400)
        .json({ success: false, message: "Thiếu idRequest" });
    }

    const idAdmin = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Kiểm tra vai trò
    const checkRoleResult = await pool
      .request()
      .input("idUser", sql.NVarChar, idAdmin)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    const role = checkRoleResult.recordset[0]?.role;
    console.log(`[DEBUG] Vai trò người dùng: ${role}`);

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    // Kiểm tra yêu cầu có tồn tại không
    const requestResult = await pool
      .request()
      .input("idRequest", sql.UniqueIdentifier, idRequest)
      .query("SELECT idUser FROM UpgradeRequests WHERE idRequest = @idRequest");

    if (requestResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy yêu cầu nâng cấp" });
    }

    // Cập nhật trạng thái yêu cầu sang rejected
    await pool.request().input("idRequest", sql.UniqueIdentifier, idRequest)
      .query(`
        UPDATE UpgradeRequests
        SET status = 'rejected', handledAt = GETDATE()
        WHERE idRequest = @idRequest
      `);

    console.log("[DEBUG] Đã từ chối yêu cầu thành công");
    res.json({
      success: true,
      message: "Đã từ chối yêu cầu nâng cấp tài khoản",
    });
  } catch (error) {
    console.error("[ERROR] Lỗi khi từ chối yêu cầu:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

const disableToolById = async (req, res) => {
  try {
    const { idTool } = req.body;
    if (!idTool) {
      return res.status(400).json({ success: false, message: "Thiếu idTool" });
    }

    // Lấy idUser từ token
    const idUser = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Kiểm tra quyền admin
    const userCheck = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userCheck.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const role = userCheck.recordset[0].role;
    if (role !== "admin") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Bạn không có quyền thực hiện hành động này",
        });
    }

    // Kiểm tra xem tool có tồn tại không
    const checkTool = await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool");

    if (checkTool.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công cụ" });
    }

    // Cập nhật trạng thái tool
    await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("UPDATE Tools SET status = 'disable' WHERE idTool = @idTool");

    res.json({ success: true, message: "Đã disable công cụ thành công" });
  } catch (error) {
    console.error("[ERROR] Lỗi khi disable công cụ:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server", error: error.message });
  }
};
const enableToolById = async (req, res) => {
  try {
    const { idTool } = req.body;
    if (!idTool) {
      return res.status(400).json({ success: false, message: "Thiếu idTool" });
    }

    // Lấy idUser từ token
    const idUser = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Kiểm tra quyền admin
    const userCheck = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userCheck.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const role = userCheck.recordset[0].role;
    if (role !== "admin") {
      return res
        .status(403)
        .json({
          success: false,
          message: "Bạn không có quyền thực hiện hành động này",
        });
    }

    // Kiểm tra xem tool có tồn tại không
    const checkTool = await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool");

    if (checkTool.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy công cụ" });
    }

    // Cập nhật trạng thái tool
    await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("UPDATE Tools SET status = 'active' WHERE idTool = @idTool");

    res.json({ success: true, message: "Đã active công cụ thành công" });
  } catch (error) {
    console.error("[ERROR] Lỗi khi active công cụ:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Lỗi server", error: error.message });
  }
};

// lấy danh sách tất cả các tool
const getAllTools = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Tools");
    res.json({
      success: true,
      message: "Lấy danh sách công cụ thành công",
      data: result.recordset,
    });
  } catch (error) {
    console.error("[ERROR] Lỗi khi lấy danh sách công cụ:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

const updateToolAccessLevel = async (req, res) => {
  try {
    const { idTool, accessLevel } = req.body;

    if (!idTool || !accessLevel) {
      return res.status(400).json({
        success: false,
        message: "Thiếu idTool hoặc accessLevel",
      });
    }

    const idUser = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Kiểm tra quyền admin
    const userCheck = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const role = userCheck.recordset[0].role;
    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện hành động này",
      });
    }

    // Kiểm tra tool tồn tại
    const toolCheck = await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool");

    if (toolCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy công cụ",
      });
    }

    // Cập nhật access level
    await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .input("accessLevel", sql.NVarChar, accessLevel)
      .query(
        "UPDATE Tools SET access_level = @accessLevel WHERE idTool = @idTool"
      );

    return res.json({
      success: true,
      message: "Cập nhật access level thành công",
    });
  } catch (error) {
    console.error("[ERROR] Lỗi khi cập nhật access level:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

module.exports = {
    getAllUpgradeRequests,
    acceptUpgradeRequest,
    rejectUpgradeRequest,
    disableToolById,
    enableToolById,
    getAllTools,
    updateToolAccessLevel,
};
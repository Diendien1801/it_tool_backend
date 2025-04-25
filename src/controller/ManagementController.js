const { sql, poolPromise } = require("../config/db");
const jwt = require("jsonwebtoken"); // Import jwt
const JWT_SECRET = process.env.JWT_SECRET; // Lấy secret từ biến môi trường
const bcrypt = require("bcrypt"); // Import bcrypt
const { v4: uuidv4 } = require("uuid");
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
    console.log(
      `[DEBUG] Thực hiện truy vấn lấy danh sách yêu cầu: ${upgradeQuery}`
    );

    const result = await pool.request().query(upgradeQuery);
    console.log(
      `[DEBUG] Số lượng yêu cầu lấy được: ${result.recordset.length}`
    );

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
    console.log("[DEBUG] Starting to process Accept Request");

    const { idRequest } = req.body;
    if (!idRequest) {
      return res
        .status(400)
        .json({ success: false, message: "Missing idRequest" });
    }

    const idAdmin = getUserIdFromToken(req); // Decode token to get idUser
    const pool = await poolPromise;

    // Check user's role
    const checkRoleResult = await pool
      .request()
      .input("idUser", sql.NVarChar, idAdmin)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    const role = checkRoleResult.recordset[0]?.role;
    console.log(`[DEBUG] User role: ${role}`);

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Get idUser from the upgrade request
    const requestResult = await pool
      .request()
      .input("idRequest", sql.UniqueIdentifier, idRequest)
      .query("SELECT idUser FROM UpgradeRequests WHERE idRequest = @idRequest");

    if (requestResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Upgrade request not found" });
    }

    const idUserToUpgrade = requestResult.recordset[0].idUser;
    console.log(`[DEBUG] Upgrading user: ${idUserToUpgrade}`);

    // Update request status and upgrade user level using a transaction
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    const request = new sql.Request(transaction);

    // Update the upgrade request status
    await request.input("idRequest", sql.UniqueIdentifier, idRequest).query(`
        UPDATE UpgradeRequests
        SET status = 'approved', handledAt = GETDATE()
        WHERE idRequest = @idRequest
      `);

    // Update user's level (set to 'premium', you can customize this)
    await request.input("idUser", sql.NVarChar, idUserToUpgrade).query(`
        UPDATE Users
        SET level = 'premium'
        WHERE idUser = @idUser
      `);

    await transaction.commit();

    console.log("[DEBUG] Successfully updated request and user");
    res.json({
      success: true,
      message: "Upgrade request approved successfully",
    });
  } catch (error) {
    console.error(
      "[ERROR] Error while accepting upgrade request:",
      error.message
    );
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

const rejectUpgradeRequest = async (req, res) => {
  try {
    console.log("[DEBUG] Starting to process Reject Request");

    const { idRequest } = req.body;
    if (!idRequest) {
      return res
        .status(400)
        .json({ success: false, message: "Missing idRequest" });
    }

    const idAdmin = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Check the role of the user
    const checkRoleResult = await pool
      .request()
      .input("idUser", sql.NVarChar, idAdmin)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    const role = checkRoleResult.recordset[0]?.role;
    console.log(`[DEBUG] User role: ${role}`);

    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Check if the upgrade request exists
    const requestResult = await pool
      .request()
      .input("idRequest", sql.UniqueIdentifier, idRequest)
      .query("SELECT idUser FROM UpgradeRequests WHERE idRequest = @idRequest");

    if (requestResult.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Upgrade request not found" });
    }

    // Update the request status to 'rejected'
    await pool.request().input("idRequest", sql.UniqueIdentifier, idRequest)
      .query(`
        UPDATE UpgradeRequests
        SET status = 'rejected', handledAt = GETDATE()
        WHERE idRequest = @idRequest
      `);

    console.log("[DEBUG] Successfully rejected the upgrade request");
    res.json({
      success: true,
      message: "Upgrade request rejected successfully",
    });
  } catch (error) {
    console.error(
      "[ERROR] Error while rejecting upgrade request:",
      error.message
    );
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


const disableToolById = async (req, res) => {
  try {
    const { idTool } = req.body;
    if (!idTool) {
      return res
        .status(400)
        .json({ success: false, message: "Missing idTool" });
    }

    // Get idUser from token
    const idUser = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Check admin permission
    const userCheck = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userCheck.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const role = userCheck.recordset[0].role;
    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Check if the tool exists
    const checkTool = await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool");

    if (checkTool.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Tool not found" });
    }

    // Update tool status
    await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("UPDATE Tools SET status = 'disable' WHERE idTool = @idTool");

    res.json({ success: true, message: "Tool has been successfully disabled" });
  } catch (error) {
    console.error("[ERROR] Error disabling the tool:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

const enableToolById = async (req, res) => {
  try {
    const { idTool } = req.body;
    if (!idTool) {
      return res
        .status(400)
        .json({ success: false, message: "Missing idTool" });
    }

    // Get idUser from token
    const idUser = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Check admin permission
    const userCheck = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userCheck.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const role = userCheck.recordset[0].role;
    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Check if the tool exists
    const checkTool = await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool");

    if (checkTool.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Tool not found" });
    }

    // Update tool status
    await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("UPDATE Tools SET status = 'active' WHERE idTool = @idTool");

    res.json({
      success: true,
      message: "Tool has been successfully activated",
    });
  } catch (error) {
    console.error("[ERROR] Error activating the tool:", error.message);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
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
        message: "Missing idTool or accessLevel",
      });
    }

    const idUser = getUserIdFromToken(req);
    const pool = await poolPromise;

    // Check admin permission
    const userCheck = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const role = userCheck.recordset[0].role;
    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Check if the tool exists
    const toolCheck = await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool");

    if (toolCheck.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tool not found",
      });
    }

    // Update access level
    await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .input("accessLevel", sql.NVarChar, accessLevel)
      .query(
        "UPDATE Tools SET access_level = @accessLevel WHERE idTool = @idTool"
      );

    return res.json({
      success: true,
      message: "Access level updated successfully",
    });
  } catch (error) {
    console.error("[ERROR] Error updating access level:", error.message);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// xóa tool
// Xóa giả một tool (soft delete), chỉ admin được phép
const softDeleteTool = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req); // Get user ID from token
    const { idTool } = req.body; // Get the tool ID from the request body

    console.log(
      `[DEBUG] Admin (${idUser}) requested to delete tool: ${idTool}`
    );

    const pool = await poolPromise; // Get database connection pool

    // Check the user's role (must be admin)
    const userResult = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const userRole = userResult.recordset[0].role;
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    }

    // Check if the tool exists in the database
    const toolResult = await pool
      .request()
      .input("idTool", sql.VarChar(50), idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool");

    if (toolResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tool not found to delete",
      });
    }

    // Perform a soft delete by setting isDelete = 1
    await pool
      .request()
      .input("idTool", sql.VarChar(50), idTool)
      .query("UPDATE Tools SET isDelete = 1 WHERE idTool = @idTool");

    res.json({
      success: true,
      message: "Tool deleted successfully",
    });
  } catch (error) {
    console.error("❌ [ERROR] Tool deletion failed:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting tool",
      error: error.message,
    });
  }
};

const addNewTool = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req); // Get user ID from token
    const pool = await poolPromise;

    // Check if the user is an admin
    const checkRole = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    const role = checkRole.recordset[0]?.role;
    if (role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thêm công cụ",
      });
    }

    // Get data from request body
    const { name, descript, iconURL, access_level, dllPath, idToolType } =
      req.body;

    // Validate required fields
    if (!name || !descript || !access_level || !dllPath || !idToolType) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc",
      });
    }

    // Generate a unique tool ID
    const idTool = uuidv4();

    // Insert the new tool into the database
    const insertQuery = `
      INSERT INTO Tools (
        idTool, name, descript, status, access_level, 
        iconURL, dllPath, idToolType, isDelete
      )
      VALUES (
        @idTool, @name, @descript, 'active', @access_level, 
        @iconURL, @dllPath, @idToolType, 0
      )
    `;

    await pool
      .request()
      .input("idTool", sql.UniqueIdentifier, idTool)
      .input("name", sql.NVarChar, name)
      .input("descript", sql.NVarChar, descript)
      .input("access_level", sql.NVarChar, access_level)
      .input("iconURL", sql.NVarChar, iconURL || "")
      .input("dllPath", sql.NVarChar, dllPath)
      .input("idToolType", sql.Int, idToolType)
      .query(insertQuery);

    res.json({
      success: true,
      message: "Thêm công cụ thành công",
      data: { idTool },
    });
  } catch (error) {
    console.error("[ERROR] Thêm tool thất bại:", error.message);
    res.status(500).json({
      success: false,
      message: "Lỗi server khi thêm tool",
      error: error.message,
    });
  }
};


const recoverTool = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    const { idTool } = req.body;

    console.log(`[DEBUG] Admin (${idUser}) yêu cầu khôi phục tool: ${idTool}`);

    const pool = await poolPromise;

    // Lấy thông tin user để kiểm tra quyền
    const userResult = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const userRole = userResult.recordset[0].role;
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    // Kiểm tra tool có tồn tại và đã bị xóa mềm chưa
    const toolResult = await pool
      .request()
      .input("idTool", sql.VarChar(50), idTool)
      .query("SELECT * FROM Tools WHERE idTool = @idTool AND isDelete = 1");

    if (toolResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tool hoặc tool chưa bị xóa",
      });
    }

    // Cập nhật isDelete = 0 để khôi phục
    await pool
      .request()
      .input("idTool", sql.VarChar(50), idTool)
      .query("UPDATE Tools SET isDelete = 0 WHERE idTool = @idTool");

    res.json({
      success: true,
      message: "Khôi phục tool thành công",
    });
  } catch (error) {
    console.error("❌ [ERROR] Khôi phục tool thất bại:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi khôi phục tool",
      error: error.message,
    });
  }
};


const addNewToolType = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req); // Get user ID from token
    const { name, iconURL } = req.body;

    // Check if name is provided
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Tên loại công cụ không được để trống",
      });
    }

    const pool = await poolPromise;

    // Check user's role (must be admin)
    const userResult = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT role FROM Users WHERE idUser = @idUser");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy người dùng",
      });
    }

    const userRole = userResult.recordset[0].role;
    if (userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    // Get list of existing tool types' IDs
    const idResult = await pool
      .request()
      .query("SELECT idToolType FROM ToolTypes");
    const idList = idResult.recordset
      .map((row) => parseInt(row.idToolType))
      .filter((n) => !isNaN(n));

    // Generate new ID (max + 1)
    const newId = (Math.max(...idList, 0) + 1).toString();

    // Insert new tool type into database
    await pool
      .request()
      .input("idToolType", sql.VarChar(50), newId)
      .input("name", sql.NVarChar(100), name.trim())
      .input("iconURL", sql.NVarChar(255), iconURL.trim()).query(`
        INSERT INTO ToolTypes (idToolType, name, iconURL)
        VALUES (@idToolType, @name, @iconURL)
      `);

    // Return success response
    res.json({
      success: true,
      message: "Thêm loại công cụ thành công",
    });
  } catch (error) {
    console.error("❌ [ERROR] Thêm loại công cụ thất bại:", error);
    res.status(500).json({
      success: false,
      message: "Lỗi khi thêm loại công cụ",
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
  softDeleteTool,
  addNewTool,
  recoverTool,
  addNewToolType,
};

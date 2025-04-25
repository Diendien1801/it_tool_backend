const { sql, poolPromise } = require("../config/db");
const jwt = require("jsonwebtoken"); // Import jwt
const JWT_SECRET = process.env.JWT_SECRET; // Lấy secret từ biến môi trường
const bcrypt = require("bcrypt"); // Import bcrypt

// Hàm giải mã token để lấy idUser
const getUserIdFromToken = (req) => {
  try {
    console.log("[DEBUG] Starting to extract idUser from token");

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error("[ERROR] Authorization Header not found");
      throw new Error("Authorization Header not found");
    }

    console.log(`[DEBUG] Authorization Header: ${authHeader}`);

    const token = authHeader.split(" ")[1]; // Extract token from "Bearer <token>"
    if (!token) {
      console.error("[ERROR] Token not found in Header");
      throw new Error("Token not found");
    }

    console.log(`[DEBUG] Token received: ${token}`);

    const decoded = jwt.verify(token, JWT_SECRET); // Decode the token
    console.log(`[DEBUG] Token decoded:`, decoded);

    if (!decoded.idUser) {
      console.error("[ERROR] idUser not found in token");
      throw new Error("idUser not found in token");
    }

    console.log(`[DEBUG] Extracted idUser: ${decoded.idUser}`);
    return decoded.idUser;
  } catch (error) {
    console.error(
      `[ERROR] Failed to extract idUser from token: ${error.message}`
    );
    throw error; // Rethrow the error to be handled by middleware/controller
  }
};


// Lấy thông tin tài khoản
const getAccountInfo = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    console.log(`[DEBUG] Fetching user info with idUser: ${idUser}`);

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
        message: "User not found",
        data: null,
      });
    }

    console.log(`[DEBUG] User info:`, result.recordset[0]);
    res.json({
      success: true,
      data: result.recordset[0],
      message: "Account information retrieved successfully",
    });
  } catch (error) {
    console.error("[ERROR] Error retrieving account information:", error);
    res.status(401).json({
      success: false,
      message: "Authentication or account retrieval error",
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
      `🔍 [DEBUG] Retrieving favorite tools list for idUser: ${idUser}`
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

    console.log("📦 [DEBUG] Query result:", result.recordset);
    res.json({
      success: true,
      data: result.recordset,
      message: "Successfully retrieved favorite tools list",
    });
  } catch (error) {
    console.error("❌ [ERROR] Error retrieving favorite tools list:", error);
    res.status(500).json({
      success: false,
      data: null,
      message: "Failed to retrieve favorite tools list",
      error: error.message,
    });
  }
};


// Thêm tool yêu thích
const addFavouriteTool = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    const { idTool } = req.body;
    console.log("Adding favourite tool:", idUser, idTool);

    const pool = await poolPromise;

    // Check if the tool already exists in the user's favourites
    const checkQuery = `SELECT * FROM FavouriteTools WHERE idUser = @idUser AND idTool = @idTool`;
    const checkResult = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .input("idTool", sql.VarChar(50), idTool)
      .query(checkQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Tool already exists in favourites list",
        data: null,
      });
    }

    // Insert the tool into the favourites list
    const insertQuery = `INSERT INTO FavouriteTools (idUser, idTool) VALUES (@idUser, @idTool)`;
    await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .input("idTool", sql.VarChar(50), idTool)
      .query(insertQuery);

    res.json({
      success: true,
      message: "Tool added to favourites successfully",
    });
  } catch (error) {
    console.error("Error while adding tool to favourites:", error);
    res.status(500).json({
      success: false,
      message: "Error while adding tool to favourites",
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
    console.log("Removing favourite tool:", idUser, idTool);

    const pool = await poolPromise;

    // Remove tool from the favourites list
    const deleteQuery = `DELETE FROM FavouriteTools WHERE idUser = @idUser AND idTool = @idTool`;
    await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .input("idTool", sql.VarChar(50), idTool)
      .query(deleteQuery);

    res.json({
      success: true,
      message: "Tool removed from favourites successfully",
    });
  } catch (error) {
    console.error("Error while removing tool from favourites:", error);
    res.status(500).json({
      success: false,
      message: "Error while removing tool from favourites",
      data: null,
      error: error.message,
    });
  }
};


// xin nâng cấp tài khoản lên premium
const requestUpgradeAccount = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    console.log(`[DEBUG] Sending upgrade request for idUser: ${idUser}`);

    const pool = await poolPromise;

    // 1. Get current account level
    const userResult = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query("SELECT level FROM Users WHERE idUser = @idUser");

    if (userResult.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const currentLevel = userResult.recordset[0].level;
    console.log(`[DEBUG] Current level: ${currentLevel}`);

    // 2. If already premium, no need to upgrade
    if (currentLevel === "premium") {
      return res.status(400).json({
        success: false,
        message: "Your account is already at the highest level (premium)",
      });
    }

    // 3. Check most recent upgrade request
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
          message:
            "You have already submitted an upgrade request and it's pending.",
        });
      }

      if (status === "accepted") {
        return res.status(400).json({
          success: false,
          message: "Your account has already been upgraded.",
        });
      }

      // If rejected, allow sending a new request
      if (status === "rejected") {
        console.log(
          `[INFO] Previous request was rejected, allowing resubmission.`
        );
      }
    }

    // 4. Insert new upgrade request (status = 'pending', createdAt = GETDATE())
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
      message:
        "Upgrade request submitted successfully. Please wait for approval.",
    });
  } catch (error) {
    console.error("❌ [ERROR] Error submitting upgrade request:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while submitting upgrade request",
      error: error.message,
    });
  }
};
// lấy danh sách yêu cầu nâng cấp history
const getUpgradeHistory = async (req, res) => {
  try {
    const idUser = getUserIdFromToken(req);
    console.log(`[DEBUG] Fetching upgrade history for idUser: ${idUser}`);

    const pool = await poolPromise;
    const query = `
      SELECT * FROM UpgradeRequests
      WHERE idUser = @idUser
      ORDER BY createdAt DESC
    `;

    const result = await pool
      .request()
      .input("idUser", sql.UniqueIdentifier, idUser)
      .query(query);

    console.log("📦 [DEBUG] Upgrade history:", result.recordset);
    res.json({
      success: true,
      data: result.recordset,
      message: "Successfully retrieved upgrade history",
    });
  } catch (error) {
    console.error("❌ [ERROR] Error retrieving upgrade history:", error);
    res.status(500).json({
      success: false,
      data: null,
      message: "Failed to retrieve upgrade history",
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
  getUpgradeHistory,
};

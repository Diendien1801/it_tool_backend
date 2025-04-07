const { sql, poolPromise } = require("../config/db");

// Lấy danh sách tất cả các danh mục ToolTypes
const getToolTypes = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM ToolTypes");
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Lỗi khi lấy danh mục ToolTypes:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách ToolTypes",
      error: error.message,
    });
  }
};

// Lấy danh sách tools theo idToolType
const getToolList = async (req, res) => {
  try {
    const { idToolType } = req.params;
    console.log("idToolType:", idToolType);
    const pool = await poolPromise;

    if (idToolType === "0") {
      // Nếu idToolType là "0", lấy tất cả tools
      const result = await pool.request().query("SELECT * FROM Tools");
      return res.json({ success: true, data: result.recordset });
    }

    // Kiểm tra nếu idToolType tồn tại trong bảng ToolTypes
    const typeCheck = await pool
      .request()
      .input("idToolType", sql.VarChar, idToolType)
      .query("SELECT 1 FROM ToolTypes WHERE idToolType = @idToolType");

    if (typeCheck.recordset.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Không tìm thấy idToolType này" });
    }

    // Nếu tồn tại, lấy danh sách tools theo idToolType
    const result = await pool
      .request()
      .input("idToolType", sql.VarChar, idToolType)
      .query("SELECT * FROM Tools WHERE idToolType = @idToolType");

    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tools:", error);
    res
      .status(500)
      .json({ message: "Lỗi khi lấy danh sách tools", error: error.message });
  }
};


// lấy danh sách tất cả các tools
const getAllTools = async (req, res) => {
  try {
    const pool = await poolPromise;
    const result = await pool.request().query("SELECT * FROM Tools");
    res.json({ success: true, data: result.recordset });
  } catch (error) {
    console.error("Lỗi khi lấy danh sách tools:", error);
    res.status(500).json({
      message: "Lỗi khi lấy danh sách tools",
      error: error.message,
    });
  }
};





module.exports = { getToolTypes, getToolList, getAllTools};

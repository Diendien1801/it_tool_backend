const express = require("express");
const router = express.Router();
const {
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
} = require("../controller/ManagementController");

// Lấy danh sách tất cả các yêu cầu nâng cấp tài khoản
router.get("/requests", getAllUpgradeRequests);
// Duyệt yêu cầu nâng cấp tài khoản
router.post("/requests/approve", acceptUpgradeRequest);
// Từ chối yêu cầu nâng cấp tài khoản
router.post("/requests/reject", rejectUpgradeRequest);
// disable tool
router.post("/tool/disable", disableToolById);
// activate tool
router.post("/tool/active", enableToolById);
// Lấy danh sách tất cả các tool
router.get("/tools", getAllTools);
// Cập nhật quyền truy cập của tool
router.post("/tool/update", updateToolAccessLevel);
// Thêm tool mới
router.post("/tool/add", addNewTool);


// xóa tool
router.post("/tool/delete", softDeleteTool);

// recover tool
router.post("/tool/recover", recoverTool);
router.post("/categories/add", addNewToolType);
module.exports = router;
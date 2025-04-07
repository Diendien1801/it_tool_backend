const express = require("express");
const router = express.Router();
const {
  getToolTypes,
  getToolList,
  getAllTools,
  
 
} = require("../controller/ToolController");

// Route GET /api/toolTypes/categories
router.get("/categories", getToolTypes);

router.get("/categories/:idToolType", getToolList);

router.get("/categories/all", getAllTools);



//router.get("/config/:idTool", getConfig);
module.exports = router;

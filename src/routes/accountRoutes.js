const express = require("express");
const router = express.Router();
const {
  getAccountInfo,
  getFavouriteTools,
  addFavouriteTool,
  removeFavouriteTool,
  requestUpgradeAccount,
  getUpgradeHistory,
} = require("../controller/AccountController");

router.get("/", getAccountInfo);
router.get("/favourite", getFavouriteTools);
router.post("/favourite/add", addFavouriteTool);
router.post("/favourite/remove", removeFavouriteTool);
router.post("/upgrade", requestUpgradeAccount);
router.get("/upgradeHistory", getUpgradeHistory);
module.exports = router;

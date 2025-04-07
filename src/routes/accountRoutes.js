const express = require("express");
const router = express.Router();
const {
  getAccountInfo,
  getFavouriteTools,
  addFavouriteTool,
  removeFavouriteTool,
  requestUpgradeAccount,
} = require("../controller/AccountController");

router.get("/", getAccountInfo);
router.get("/favourite", getFavouriteTools);
router.post("/favourite/add", addFavouriteTool);
router.post("/favourite/remove", removeFavouriteTool);
router.post("/upgrade", requestUpgradeAccount);

module.exports = router;

const express = require("express");
const router = express.Router();
const { searchUsers, getPublicProfile, updateMyProfile } = require("../controllers/userController");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

router.get("/search", searchUsers);
router.patch("/me", updateMyProfile);
router.get("/:userId", getPublicProfile);

module.exports = router;

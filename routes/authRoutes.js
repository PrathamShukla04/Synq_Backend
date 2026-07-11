const express = require("express");
const router = express.Router();
const { register, login, refresh, logout, getMe } = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", verifyToken, getMe);

module.exports = router;

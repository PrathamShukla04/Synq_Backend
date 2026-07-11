const express = require("express");
const router = express.Router();

const { runCode } = require("../controllers/executionController");

// Run Code
router.post("/run", runCode);

module.exports = router;
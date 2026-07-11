const express = require("express");
const router = express.Router();
const {
  complete,
  detectBugs,
  explain,
  refactor,
  generateDocs,
  generateTests,
  chat,
} = require("../controllers/aiController");
const { verifyToken } = require("../middleware/auth");
const { checkProjectAccess } = require("../middleware/projectAccess");

router.use(verifyToken);

router.post("/:projectId/complete", checkProjectAccess("viewer"), complete);
router.post("/:projectId/detect-bugs", checkProjectAccess("viewer"), detectBugs);
router.post("/:projectId/explain", checkProjectAccess("viewer"), explain);
router.post("/:projectId/refactor", checkProjectAccess("editor"), refactor);
router.post("/:projectId/docs", checkProjectAccess("editor"), generateDocs);
router.post("/:projectId/tests", checkProjectAccess("editor"), generateTests);
router.post("/:projectId/chat", checkProjectAccess("viewer"), chat);

module.exports = router;
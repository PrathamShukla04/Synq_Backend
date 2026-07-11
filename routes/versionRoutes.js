const express = require("express");
const router = express.Router();
const { getVersions, restoreVersion } = require("../controllers/versionController");
const { verifyToken } = require("../middleware/auth");
const { checkProjectAccess } = require("../middleware/projectAccess");

router.use(verifyToken);

router.get("/:projectId/:fileId", checkProjectAccess("viewer"), getVersions);
router.post("/:projectId/:fileId/:versionId/restore", checkProjectAccess("editor"), restoreVersion);

module.exports = router;
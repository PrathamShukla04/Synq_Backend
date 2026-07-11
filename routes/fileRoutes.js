const express = require("express");
const router = express.Router();
const { getFileTree, createFile, getFile, updateFile, deleteFile } = require("../controllers/fileController");
const { verifyToken } = require("../middleware/auth");
const { checkProjectAccess } = require("../middleware/projectAccess");

router.use(verifyToken);

router.get("/:projectId", checkProjectAccess("viewer"), getFileTree);
router.post("/:projectId", checkProjectAccess("editor"), createFile);
router.get("/:projectId/:fileId", checkProjectAccess("viewer"), getFile);
router.patch("/:projectId/:fileId", checkProjectAccess("editor"), updateFile);
router.delete("/:projectId/:fileId", checkProjectAccess("editor"), deleteFile);

module.exports = router;

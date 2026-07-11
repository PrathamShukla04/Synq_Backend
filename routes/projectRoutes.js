const express = require("express");
const router = express.Router();
const {
  createProject,
  getMyProjects,
  getProject,
  updateProject,
  deleteProject,
  addCollaborator,
  removeCollaborator,
} = require("../controllers/projectController");
const { sendInvite, listProjectInvites } = require("../controllers/projectInviteController");
const { verifyToken } = require("../middleware/auth");
const { checkProjectAccess } = require("../middleware/projectAccess");

router.use(verifyToken);

router.post("/", createProject);
router.get("/", getMyProjects);

router.get("/:projectId", checkProjectAccess("viewer"), getProject);
router.patch("/:projectId", checkProjectAccess("editor"), updateProject);
router.delete("/:projectId", checkProjectAccess("owner"), deleteProject);

router.post("/:projectId/collaborators", checkProjectAccess("owner"), addCollaborator);
router.delete("/:projectId/collaborators/:collaboratorId", checkProjectAccess("owner"), removeCollaborator);

// invite a connection to collaborate on this project (owner only, requires accept)
router.post("/:projectId/invites", checkProjectAccess("owner"), sendInvite);
router.get("/:projectId/invites", checkProjectAccess("owner"), listProjectInvites);

module.exports = router;

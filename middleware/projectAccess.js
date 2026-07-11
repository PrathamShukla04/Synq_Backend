const Project = require("../models/Project");

// Attaches req.project and req.role. Use after verifyToken.
const checkProjectAccess = (minRole = "viewer") => {
  const roleRank = { viewer: 1, editor: 2, owner: 3 };

  return async (req, res, next) => {
    try {
      const { projectId } = req.params;
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      let role = null;
      if (project.ownerId.toString() === req.userId) {
        role = "owner";
      } else {
        const collab = project.collaborators.find((c) => c.userId.toString() === req.userId);
        if (collab) role = collab.role;
      }

      if (!role) {
        return res.status(403).json({ message: "You do not have access to this project" });
      }

      if (roleRank[role] < roleRank[minRole]) {
        return res.status(403).json({ message: "Insufficient permissions" });
      }

      req.project = project;
      req.role = role;
      next();
    } catch (err) {
      return res.status(500).json({ message: "Server error checking project access" });
    }
  };
};

module.exports = { checkProjectAccess };

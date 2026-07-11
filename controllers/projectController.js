const Project = require("../models/Project");
const File = require("../models/File");
const User = require("../models/User");

// POST /api/projects
const createProject = async (req, res, next) => {
  try {
    const { name, description, language, isPublic } = req.body;
    if (!name) return res.status(400).json({ message: "Project name is required" });

    const project = await Project.create({
      name,
      description,
      language,
      isPublic,
      ownerId: req.userId,
      collaborators: [{ userId: req.userId, role: "owner" }],
    });

    // create default root folder
    await File.create({
      projectId: project._id,
      name: "root",
      path: "/",
      type: "folder",
      parentId: null,
    });

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects  (all projects the user owns or collaborates on)
const getMyProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      $or: [{ ownerId: req.userId }, { "collaborators.userId": req.userId }],
    }).sort({ updatedAt: -1 });

    res.json({ projects });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:projectId  (requires checkProjectAccess middleware)
const getProject = async (req, res, next) => {
  res.json({ project: req.project, role: req.role });
};

// PATCH /api/projects/:projectId  (owner/editor)
const updateProject = async (req, res, next) => {
  try {
    const { name, description, language, isPublic } = req.body;
    const project = req.project;

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (language !== undefined) project.language = language;
    if (isPublic !== undefined) project.isPublic = isPublic;

    await project.save();
    res.json({ project });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/projects/:projectId  (owner only)
const deleteProject = async (req, res, next) => {
  try {
    if (req.role !== "owner") {
      return res.status(403).json({ message: "Only the owner can delete this project" });
    }
    await File.deleteMany({ projectId: req.project._id });
    await req.project.deleteOne();
    res.json({ message: "Project deleted" });
  } catch (err) {
    next(err);
  }
};

// POST /api/projects/:projectId/collaborators  (owner only)
const addCollaborator = async (req, res, next) => {
  try {
    if (req.role !== "owner") {
      return res.status(403).json({ message: "Only the owner can add collaborators" });
    }

    const { email, role } = req.body;
    if (!email) return res.status(400).json({ message: "Collaborator email is required" });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ message: "No user found with that email" });

    const project = req.project;
    const alreadyExists = project.collaborators.some((c) => c.userId.toString() === user._id.toString());
    if (alreadyExists) {
      return res.status(409).json({ message: "User is already a collaborator" });
    }

    project.collaborators.push({ userId: user._id, role: role || "editor" });
    await project.save();

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/projects/:projectId/collaborators/:collaboratorId  (owner only)
const removeCollaborator = async (req, res, next) => {
  try {
    if (req.role !== "owner") {
      return res.status(403).json({ message: "Only the owner can remove collaborators" });
    }

    const { collaboratorId } = req.params;
    const project = req.project;

    project.collaborators = project.collaborators.filter(
      (c) => c.userId.toString() !== collaboratorId
    );
    await project.save();

    res.json({ project });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createProject,
  getMyProjects,
  getProject,
  updateProject,
  deleteProject,
  addCollaborator,
  removeCollaborator,
};

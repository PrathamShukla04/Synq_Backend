const ProjectInvite = require("../models/ProjectInvite");
const Project = require("../models/Project");

const PUBLIC_FIELDS = "name email avatarUrl";

// POST /api/projects/:projectId/invites  (owner only, via checkProjectAccess("owner"))
const sendInvite = async (req, res, next) => {
  try {
    const { toUserId, role } = req.body;
    if (!toUserId) return res.status(400).json({ message: "toUserId is required" });

    const project = req.project;

    if (project.ownerId.toString() === toUserId) {
      return res.status(400).json({ message: "This user already owns the project" });
    }

    const alreadyCollaborator = project.collaborators.some((c) => c.userId.toString() === toUserId);
    if (alreadyCollaborator) {
      return res.status(409).json({ message: "User is already a collaborator" });
    }

    const existingPending = await ProjectInvite.findOne({
      projectId: project._id,
      toUserId,
      status: "pending",
    });
    if (existingPending) {
      return res.status(409).json({ message: "An invite is already pending for this user" });
    }

    const invite = await ProjectInvite.create({
      projectId: project._id,
      fromUserId: req.userId,
      toUserId,
      role: role === "viewer" ? "viewer" : "editor",
    });

    res.status(201).json({ invite });
  } catch (err) {
    next(err);
  }
};

// GET /api/projects/:projectId/invites  (owner only — invites sent for this project)
const listProjectInvites = async (req, res, next) => {
  try {
    const invites = await ProjectInvite.find({ projectId: req.project._id })
      .populate("toUserId", PUBLIC_FIELDS)
      .sort({ createdAt: -1 });

    res.json({ invites });
  } catch (err) {
    next(err);
  }
};

// GET /api/invites  (my incoming pending invites, across all projects)
const listMyInvites = async (req, res, next) => {
  try {
    const invites = await ProjectInvite.find({ toUserId: req.userId, status: "pending" })
      .populate("fromUserId", PUBLIC_FIELDS)
      .populate("projectId", "name description language")
      .sort({ createdAt: -1 });

    res.json({ invites });
  } catch (err) {
    next(err);
  }
};

// POST /api/invites/:inviteId/accept
const acceptInvite = async (req, res, next) => {
  try {
    const invite = await ProjectInvite.findById(req.params.inviteId);
    if (!invite) return res.status(404).json({ message: "Invite not found" });
    if (invite.toUserId.toString() !== req.userId) {
      return res.status(403).json({ message: "This invite isn't for you" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ message: "This invite is no longer pending" });
    }

    const project = await Project.findById(invite.projectId);
    if (!project) return res.status(404).json({ message: "Project no longer exists" });

    const alreadyCollaborator = project.collaborators.some(
      (c) => c.userId.toString() === req.userId
    );
    if (!alreadyCollaborator) {
      project.collaborators.push({ userId: req.userId, role: invite.role });
      await project.save();
    }

    invite.status = "accepted";
    await invite.save();

    res.json({ invite, project });
  } catch (err) {
    next(err);
  }
};

// POST /api/invites/:inviteId/reject
const rejectInvite = async (req, res, next) => {
  try {
    const invite = await ProjectInvite.findById(req.params.inviteId);
    if (!invite) return res.status(404).json({ message: "Invite not found" });
    if (invite.toUserId.toString() !== req.userId) {
      return res.status(403).json({ message: "This invite isn't for you" });
    }

    invite.status = "rejected";
    await invite.save();
    res.json({ invite });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendInvite, listProjectInvites, listMyInvites, acceptInvite, rejectInvite };

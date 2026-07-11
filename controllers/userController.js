const User = require("../models/User");
const Connection = require("../models/Connection");

const PUBLIC_FIELDS = "name email avatarUrl bio skills githubLink createdAt";

// Works out how `viewerId` relates to `targetId`: none | connected | pending_sent | pending_received
const connectionStatusBetween = async (viewerId, targetId) => {
  if (viewerId === targetId) return "self";

  const conn = await Connection.findOne({
    $or: [
      { requester: viewerId, recipient: targetId },
      { requester: targetId, recipient: viewerId },
    ],
  });

  if (!conn) return "none";
  if (conn.status === "accepted") return "connected";
  if (conn.status === "rejected") return "none";

  // pending
  return conn.requester.toString() === viewerId ? "pending_sent" : "pending_received";
};

// GET /api/users/search?q=...  (empty q -> list all users, for the Discover tab)
const searchUsers = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();

    const filter = q
      ? {
          _id: { $ne: req.userId },
          $or: [
            { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
            { email: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
            { skills: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
          ],
        }
      : { _id: { $ne: req.userId } };

    const users = await User.find(filter)
      .select(PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(50);

    const results = await Promise.all(
      users.map(async (u) => ({
        ...u.toObject(),
        connectionStatus: await connectionStatusBetween(req.userId, u._id.toString()),
      }))
    );

    res.json({ users: results });
  } catch (err) {
    next(err);
  }
};

// GET /api/users/:userId
const getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select(PUBLIC_FIELDS);
    if (!user) return res.status(404).json({ message: "User not found" });

    const connectionStatus = await connectionStatusBetween(req.userId, user._id.toString());

    res.json({ user, connectionStatus });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/me
const updateMyProfile = async (req, res, next) => {
  try {
    const { name, bio, skills, githubLink, avatarUrl } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name !== undefined) user.name = name;
    if (bio !== undefined) user.bio = bio.slice(0, 300);
    if (githubLink !== undefined) user.githubLink = githubLink;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (skills !== undefined) {
      user.skills = Array.isArray(skills)
        ? skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
        : user.skills;
    }

    await user.save();

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        skills: user.skills,
        githubLink: user.githubLink,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { searchUsers, getPublicProfile, updateMyProfile, connectionStatusBetween };
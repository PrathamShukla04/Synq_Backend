const mongoose = require("mongoose");

// Invite to collaborate on one specific project. Separate from Connection —
// you can invite someone to a project once you're connected with them.
const projectInviteSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    toUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["editor", "viewer"], default: "editor" },
    status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProjectInvite", projectInviteSchema);

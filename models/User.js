const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 300 },
    skills: { type: [String], default: [] },
    githubLink: { type: String, default: "" },
    githubId: { type: String, default: null },
    githubAccessToken: { type: String, default: null, select: false },
    refreshToken: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = async function (plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

module.exports = mongoose.model("User", userSchema);

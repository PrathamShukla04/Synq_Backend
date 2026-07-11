const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    name: { type: String, required: true },
    path: { type: String, required: true }, // full path e.g. /src/index.js
    type: { type: String, enum: ["file", "folder"], required: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "File", default: null },
    content: { type: String, default: "" },
    language: { type: String, default: "plaintext" },
  },
  { timestamps: true }
);

fileSchema.index({ projectId: 1, path: 1 }, { unique: true });

module.exports = mongoose.model("File", fileSchema);

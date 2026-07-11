const File = require("../models/File");
const Version = require("../models/Version");

const detectLanguage = (filename) => {
  const ext = filename.split(".").pop().toLowerCase();
  const map = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    html: "html",
    css: "css",
    json: "json",
    md: "markdown",
  };
  return map[ext] || "plaintext";
};

// GET /api/files/:projectId  → full file tree for a project
const getFileTree = async (req, res, next) => {
  try {
    const files = await File.find({ projectId: req.params.projectId }).sort({ path: 1 });
    res.json({ files });
  } catch (err) {
    next(err);
  }
};

// POST /api/files/:projectId  → create file or folder
const createFile = async (req, res, next) => {
  try {
    const { name, path, type, parentId } = req.body;
    if (!name || !path || !type) {
      return res.status(400).json({ message: "name, path and type are required" });
    }

    const file = await File.create({
      projectId: req.params.projectId,
      name,
      path,
      type,
      parentId: parentId || null,
      language: type === "file" ? detectLanguage(name) : "plaintext",
      content: "",
    });

    res.status(201).json({ file });
  } catch (err) {
    next(err);
  }
};

// GET /api/files/:projectId/:fileId  → get single file content
const getFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, projectId: req.params.projectId });
    if (!file) return res.status(404).json({ message: "File not found" });
    res.json({ file });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/files/:projectId/:fileId  → update content, rename, move
// PATCH /api/files/:projectId/:fileId  → update content, rename, move
const updateFile = async (req, res, next) => {
  try {
    const { content, name, path, parentId, saveVersion } = req.body;
    const file = await File.findOne({ _id: req.params.fileId, projectId: req.params.projectId });
    if (!file) return res.status(404).json({ message: "File not found" });

    // snapshot previous content before overwriting, if requested —
    // never let a snapshot failure block the actual save below
    if (saveVersion && content !== undefined && content !== file.content) {
      try {
        await Version.create({
          fileId: file._id,
          projectId: file.projectId,
          content: file.content ?? "",
          authorId: req.userId,
          message: req.body.versionMessage || "Auto-save",
        });
      } catch (versionErr) {
        console.error("Version snapshot failed (save will continue):", versionErr.message);
      }
    }

    if (content !== undefined) file.content = content;
    if (name !== undefined) {
      file.name = name;
      file.language = detectLanguage(name);
    }
    if (path !== undefined) file.path = path;
    if (parentId !== undefined) file.parentId = parentId;

    await file.save();
    res.json({ file });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/files/:projectId/:fileId
const deleteFile = async (req, res, next) => {
  try {
    const file = await File.findOne({ _id: req.params.fileId, projectId: req.params.projectId });
    if (!file) return res.status(404).json({ message: "File not found" });

    if (file.type === "folder") {
      // delete all descendants whose path starts with this folder's path
      await File.deleteMany({
        projectId: req.params.projectId,
        path: { $regex: `^${file.path}` },
      });
    } else {
      await file.deleteOne();
    }

    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
};

module.exports = { getFileTree, createFile, getFile, updateFile, deleteFile };

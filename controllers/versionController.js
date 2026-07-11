const Version = require("../models/Version");
const File = require("../models/File");

exports.getVersions = async (req, res) => {
  try {
    const { fileId } = req.params;
    const versions = await Version.find({ fileId }).sort({ createdAt: -1 });
    res.json({ versions });
  } catch (err) {
    res.status(500).json({ message: "Could not fetch version history" });
  }
};

exports.restoreVersion = async (req, res) => {
  try {
    const { fileId, versionId } = req.params;

    const version = await Version.findOne({ _id: versionId, fileId });
    if (!version) {
      return res.status(404).json({ message: "Version not found" });
    }

    const file = await File.findById(fileId);
    if (!file) {
      return res.status(404).json({ message: "File not found" });
    }

    // snapshot current content before overwriting, so restore is itself reversible
    await Version.create({
      fileId: file._id,
      projectId: file.projectId,
      content: file.content,
      authorId: req.user?.id || req.user?._id,
      message: "Auto-snapshot before restore",
    });

    file.content = version.content;
    await file.save();

    res.json({ content: file.content });
  } catch (err) {
    res.status(500).json({ message: "Could not restore version" });
  }
};
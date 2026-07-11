const { executeCode } = require("../services/pistonService");
const { getLanguageConfig } = require("../utils/languageMap");

const runCode = async (req, res) => {
  try {
    const { language, code, stdin = "" } = req.body;

    if (!language || !code) {
      return res.status(400).json({
        success: false,
        message: "Language and code are required.",
      });
    }

    const config = getLanguageConfig(language);

    if (!config) {
      return res.status(400).json({
        success: false,
        message: "Unsupported language.",
      });
    }

    const result = await executeCode({
      language: config.language,
      version: config.version,
      code,
      stdin,
    });

    return res.status(200).json({
      success: true,
      language,
      output: result.run?.stdout || "",
      error: result.run?.stderr || "",
      compileOutput: result.compile?.stderr || "",
      executionTime: result.run?.time || null,
      memory: result.run?.memory || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Execution failed.",
    });
  }
};

module.exports = {
  runCode,
};
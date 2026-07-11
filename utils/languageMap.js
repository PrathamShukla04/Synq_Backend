/**
 * Supported languages for Piston API
 *
 * key   -> frontend/backend language
 * value -> piston language + version
 */

const LANGUAGE_MAP = {
  javascript: {
    language: "javascript",
    version: "18.15.0",
  },

  typescript: {
    language: "typescript",
    version: "5.0.3",
  },

  python: {
    language: "python",
    version: "3.10.0",
  },

  java: {
    language: "java",
    version: "15.0.2",
  },

  c: {
    language: "c",
    version: "10.2.0",
  },

  cpp: {
    language: "c++",
    version: "10.2.0",
  },

  csharp: {
    language: "csharp",
    version: "6.12.0",
  },

  go: {
    language: "go",
    version: "1.16.2",
  },

  rust: {
    language: "rust",
    version: "1.68.2",
  },

  php: {
    language: "php",
    version: "8.2.3",
  },

  ruby: {
    language: "ruby",
    version: "3.0.1",
  },

  kotlin: {
    language: "kotlin",
    version: "1.8.20",
  },

  swift: {
    language: "swift",
    version: "5.3.3",
  },
};

/**
 * Get Piston configuration
 */

const getLanguageConfig = (language) => {
  return LANGUAGE_MAP[language.toLowerCase()] || null;
};

module.exports = {
  LANGUAGE_MAP,
  getLanguageConfig,
};
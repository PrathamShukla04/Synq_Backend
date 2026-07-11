const axios = require("axios");

const PISTON_API_URL = process.env.PISTON_API_URL;
/**
 * Execute code using Piston API
 *
 * @param {Object} payload
 * @param {string} payload.language
 * @param {string} payload.version
 * @param {string} payload.code
 * @param {string} [payload.stdin]
 * @returns {Promise<Object>}
 */

const executeCode = async ({
  language,
  version,
  code,
  stdin = "",
}) => {
  try {
    const response = await axios.post(
      PISTON_API_URL,
      {
        language,
        version,
        files: [
          {
            name: "main",
            content: code,
          },
        ],
        stdin,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message ||
          "Piston API returned an error."
      );
    }

    if (error.request) {
      throw new Error("Unable to connect to Piston API.");
    }

    throw new Error(error.message);
  }
};

module.exports = {
  executeCode,
};
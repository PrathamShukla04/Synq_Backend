const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "Duplicate field value", field: Object.keys(err.keyValue)[0] });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal server error",
  });
};

module.exports = { notFound, errorHandler };

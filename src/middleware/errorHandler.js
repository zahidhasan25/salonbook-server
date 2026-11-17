export function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Central error handler — never leak stack traces in production.
export function errorHandler(err, req, res, next) {
  console.error(err);
  if (err?.name === "ValidationError") {
    return res.status(400).json({ message: err.message });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ message: "Duplicate record: this already exists" });
  }
  if (err?.name === "CastError") {
    return res.status(400).json({ message: "Invalid id format" });
  }
  const status = err?.status || 500;
  res.status(status).json({
    message: err?.message || "Internal server error",
    ...(process.env.NODE_ENV !== "production" && err?.stack ? { stack: err.stack } : {}),
  });
}

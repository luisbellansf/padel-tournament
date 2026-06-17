// Wraps async route handlers so rejections reach the Express 4 error handler.
// Express 5 does this automatically; remove once upgraded.
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

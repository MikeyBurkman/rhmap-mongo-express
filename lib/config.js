'use strict';

exports.isLocal = () => !process.env.FH_APPNAME;

/**
 * Gets the number of ms that the mongo-express middleware will live before
 * being expired and (hopefully) garbage collected.
 * This hopefully fixes a memory leak in mongo-express.
 */
exports.getDbExpireMs = () => 600 * 60 * 1000; // 1 hour

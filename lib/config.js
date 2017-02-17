'use strict';

exports.isLocal = function() {
  return !process.env.FH_APPNAME;
};

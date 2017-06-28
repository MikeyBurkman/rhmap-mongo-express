'use strict';

module.exports = createExpireMiddleware;

/**
 * Intercept middleware that only keeps the given middleware in memory when
 *  necessary. If the middleware isn't used in ttl millis, then it will be
 *  garbage collected (if possible).
 * @param {function} createMiddlewareFn No-arg function for creating the middleware when it's needed
 * @param {number} ttl Number of millis the middleware will be kept around
 */
function createExpireMiddleware(createMiddlewareFn, ttl) {
  let timeout = null;
  let middleware = null;

  return function(req, res, next) {
    clearTimeout(timeout);
    timeout = setTimeout(remove, ttl);

    if (!middleware) {
      middleware = Promise.resolve().then(() => {
        const mw = createMiddlewareFn();
        // Need to delay a little for the middleware to be created.
        // This is a hack, but I'm not totally sure how to get around it.
        // If we don't wait long enough, it will complain that the database listed
        //  in the path doesn't exist and route you to the root directory.
        return delay(3000).then(() => mw);
      });
    }

    middleware.then((mw) => mw(req, res, next));
  };

  function remove() {
    middleware = null;
  }
}

function delay(ms) {
  return new Promise((res) => {
    setTimeout(res, ms);
  });
}

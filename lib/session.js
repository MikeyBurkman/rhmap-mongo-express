'use strict';

const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const mongodb = require('./db');

const sessionSecret = process.env.SESSION_SECRET || 'default cat secret';

const store = new MongoStore({
  dbPromise: mongodb.getInstance(),
  collection: 'SESSIONS_RHMAP_MONGODB',
  ttl: 12 * 60 * 60 // = 12 hours
});

exports.getExpressSession = function() {
  return session({
    name: 'db9000_sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: true,
    store: store
  });
};

'use strict';

const LocalStrategy = require('passport-local').Strategy;
const rhmapAuth = require('rhmap-auth');
const config = require('./config');

exports.init = function(passport) {
  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });

  passport.deserializeUser(function(userId, done) {
    done(null, {
      id: userId
    });
  });

  passport.use(
    new LocalStrategy({ passReqToCallback: true }, function(
      req,
      userId,
      password,
      done
    ) {
      if (config.isLocal()) {
        done(null, { id: userId });
        //done(null, false);
      } else {
        authRhmap(req, userId, password, done);
      }
    })
  );
};

function authRhmap(req, userId, password, done) {
  rhmapAuth(userId, password, function(err, isValid) {
    if (err) {
      console.log('Error in rhmapAuth:', err.stack || err);
      return done(err);
    } else if (!isValid) {
      console.log('Bad username/password from ', userId);
      return done(null, false);
    } else {
      // Success!
      console.log('User logged in: ', userId);
      const user = {
        id: userId
      };
      return done(null, user);
    }
  });
}

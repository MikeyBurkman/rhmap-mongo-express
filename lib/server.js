'use strict';

const Promise = require('bluebird');
const mbaasApi = require('fh-mbaas-api');
const express = require('express');
const path = require('path');
const domain = require('domain');
const mbaasExpress = mbaasApi.mbaasExpress();
const cors = require('cors');
const passport = require('passport');
const bodyParser = require('body-parser');
const mongoExpress = require('mongo-express/lib/middleware');

Promise.onPossiblyUnhandledRejection((err) =>
  console.error('Unhandled rejection: ', err.stack || err)
);

const db = require('./db');
const mongoConfig = require('./mongoConfig');
const config = require('./config');
const session = require('./session');
const expire = require('./expireMiddleware');

const port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
const host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';

// DBs which we encountered errors, so they may not work
const dbBadList = {};

const app = express();

app.use(require('connect-flash')());
app.use(require('cookie-parser')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

require('./rhmapAuthPassport').init(passport);
app.use(session.getExpressSession());
app.use(passport.initialize());
app.use(passport.session());

// Enable CORS for all requests
app.use(cors());

// Note: the order which we add middleware to Express here is important!
app.use('/sys', mbaasExpress.sys([]));
app.use('/mbaas', mbaasExpress.mbaas);

// Note: important that this is added just before your own Routes
app.use(mbaasExpress.fhmiddleware());

app.engine('pug', require('pug').__express);
app.set('view engine', 'pug');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', function(req, res) {
  res.redirect('/home');
});

app.get('/login', function(req, res) {
  res.render('login', { destination: req.query.to });
});

const requiresAuth = function(req, res, next) {
  if (config.isLocal() || req.isAuthenticated()) {
    next();
  } else {
    res.redirect('/login?to=' + encodeURIComponent(req.originalUrl));
  }
};
app.use('/dbs/*', requiresAuth);
app.use('/home', requiresAuth);

app.post('/login', function(req, res, next) {
  passport.authenticate('local', function(err, user) {
    if (err) {
      return next(err);
    }

    const dest = req.body.destination;

    if (!user) {
      return res.redirect('/login' + dest ? '?to=' + encodeURIComponent(dest) : '');
    }

    req.logIn(user, function(err) {
      if (err) {
        return next(err);
      }

      if (dest) {
        res.redirect(dest);
      } else {
        res.redirect('/home');
      }
    });
  })(req, res, next);
});

app.get('/home', function(req, res) {
  getFormattedDbs().then((databases) => {
    res.render('home', {
      databases: databases,
      isLocal: config.isLocal(),
      badlist: dbBadList
    });
  });
});

app.post('/home', function(req, res) {
  Promise.resolve()
    .then(() => {
      if (req.body.action === 'add') {
        return db
          .addDatabase(req.body.name, req.body.env, req.body.mongourl)
          .then(formatDb)
          .then((formattedDb) => addDbRoute(app, formattedDb));
      } else if (req.body.action === 'delete') {
        return db.deleteDatabase(req.body.name, req.body.mongourl);
      } else {
        console.log('ERROR: Unknown action: ', req.body.action);
      }
    })
    .catch((err) => console.log('ERROR in post to home', req.body, err.stack || err))
    .then(() => res.redirect('/home'));
});

// Load initial databases
getFormattedDbs()
  .then((databases) => {
    if (databases.length === 0) {
      console.log(
        'WARNING: No databases were in mongo, so this app is pretty useless right now...'
      );
    }

    databases.forEach((db) => {
      addDbRoute(app, db);
    });

    // Important that this is last!
    app.use(mbaasExpress.errorHandler());

    app.listen(port, host, function() {
      console.log('App started at: ' + new Date() + ' on port: ' + port);
    });
  })
  .catch(function(err) {
    console.log('Error!', err.stack || err);
  });

// Util functions below

function getFormattedDbs() {
  return db.getAllDatabases().then((databases) => {
    const validDbs = databases.filter(dbIsValid);
    return validDbs.map(formatDb);
  });
}

function dbIsValid(db) {
  if (!db.name) {
    console.log('ERROR: A database in the collection has no name. It is being ignored');
    return false;
  }

  if (!db.url) {
    console.log(`ERROR: Database ${db.name} has no url. It is being ignored`);
    return false;
  }

  return true;
}

function formatDb(db) {
  return {
    name: db.name,
    url: db.url,
    roPath: '/dbs/readonly/' + encodeURI(db.name),
    edPath: '/dbs/editable/' + encodeURI(db.name),
    env: db.env
  };
}

function addDbRoute(app, formattedDb) {
  console.log(
    'Loading database: ',
    JSON.stringify({ name: formattedDb.name, path: formattedDb.path })
  );

  // The mongo-express middleware throws an exception if there's an issue
  //  calling Mongo. We don't want this to crash the process!
  var d = domain.create();
  d.on('error', (err) => {
    dbBadList[formattedDb.name] = true;
    if (err.name === 'MongoError') {
      console.log('ERROR in Mongo ' + formattedDb.name + ': ', err.stack || err);
    } else {
      throw err;
    }
  });
  d.run(() => {
    // Reset in-use flags for the database at startup
    db.flagDbLoaded(formattedDb.name, true, false);
    db.flagDbLoaded(formattedDb.name, false, false);

    app.use(
      formattedDb.roPath,
      // TODO Clean this up a lot...
      expire(
        () => {
          db.flagDbLoaded(formattedDb.name, formattedDb.url, true, true);
          return mongoExpress(mongoConfig(formattedDb.url, true));
        },
        config.getDbExpireMs(),
        () => db.flagDbLoaded(formattedDb.name, formattedDb.url, true, false)
      )
    );
    app.use(
      formattedDb.edPath,
      expire(
        () => {
          db.flagDbLoaded(formattedDb.name, formattedDb.url, false, true);
          return mongoExpress(mongoConfig(formattedDb.url, false));
        },
        config.getDbExpireMs(),
        () => db.flagDbLoaded(formattedDb.name, formattedDb.url, false, false)
      )
    );
  });
}

'use strict';

const mbaasApi = require('fh-mbaas-api');
const express = require('express');
const path = require('path');
const domain = require('domain');
const expressSession = require('express-session');
const mbaasExpress = mbaasApi.mbaasExpress();
const cors = require('cors');
const passport = require('passport');
const bodyParser = require('body-parser');
const mongoExpress = require('mongo-express/lib/middleware');

const db = require('./db');
const mongoConfig = require('./mongoConfig');
const config = require('./config');

const sessionSecret = process.env.SESSION_SECRET || 'default cat secret';
const port = process.env.FH_PORT || process.env.OPENSHIFT_NODEJS_PORT || 8001;
const host = process.env.OPENSHIFT_NODEJS_IP || '0.0.0.0';

// DBs which we encountered errors, so they may not work
const dbBadList = {};

const app = express();

app.use(require('connect-flash')());
app.use(require('cookie-parser')());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());

require('./rhmapAuthPassport').init(passport);
app.use(
  require('express-session')({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false
  })
);
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
  res.render('index');
});

const requiresAuth = function(req, res, next) {
  if (config.isLocal() || req.isAuthenticated()) {
    next();
  } else {
    res.redirect('/login');
  }
};
app.use('/dbs/*', requiresAuth);
app.use('/home', requiresAuth);

app.post(
  '/login',
  passport.authenticate('local', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/home');
  }
);

app.get('/home', function(req, res) {
  getFormattedDbs().then(databases => {
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
        return db.addDatabase(req.body.name, req.body.env, req.body.mongourl);
      } else if (req.body.action === 'delete') {
        return db.deleteDatabase(req.body.name, req.body.mongourl);
      } else {
        console.log('ERROR: Unknown action: ', req.body.action);
      }
    })
    .catch(err =>
      console.log('ERROR in post to home', req.body, err.stack || err))
    .then(() => res.redirect('/home'));
});

getFormattedDbs()
  .then(databases => {
    if (databases.length === 0) {
      console.log(
        'WARNING: No databases were in mongo, so this app is pretty useless right now...'
      );
    }

    databases.forEach(db => {
      console.log(
        'Loading database: ',
        JSON.stringify({ name: db.name, path: db.path })
      );

      // The mongo-express middleware throws an exception if there's an issue
      //  calling Mongo. We don't want this to crash the process!
      var d = domain.create();
      d.on('error', err => {
        dbBadList[db.name] = true;
        if (err.name === 'MongoError') {
          console.log('ERROR in Mongo ' + db.name + ': ', err.stack || err);
        } else {
          throw err;
        }
      });
      d.run(() => {
        app.use(db.roPath, mongoExpress(mongoConfig(db.url, true)));
        app.use(db.edPath, mongoExpress(mongoConfig(db.url, false)));
      });
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

function getFormattedDbs() {
  return db.getAllDatabases().then(databases => {
    const validDbs = databases.filter(db => {
      if (!db.name) {
        console.log(
          'ERROR: A database in the collection has no name. It is being ignored'
        );
        return false;
      }

      if (!db.url) {
        console.log(
          `ERROR: Database ${db.name} has no url. It is being ignored`
        );
        return false;
      }

      return true;
    });

    return validDbs.map(db => ({
      name: db.name,
      url: db.url,
      roPath: '/dbs/readonly/' + encodeURI(db.name),
      edPath: '/dbs/editable/' + encodeURI(db.name),
      env: db.env
    }));
  });
}

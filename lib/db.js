'use strict';

const mongo = require('rhmap-mongodb');
const config = require('./config');

const collection = mongo.collection('databases');

exports.getAllDatabases = config.isLocal() ? getLocalDatabase : getAllDatabases;

exports.addDatabase = function(name, env, url) {
  return collection.insert({
    name: name,
    env: env,
    url: url
  });
};

exports.deleteDatabase = function(name, url) {
  return collection.remove({
    name: name,
    url: url
  });
};

function getAllDatabases() {
  return collection
    .find()
    .then(cursor => cursor.sort({ name: 1 }).toArray())
    .then(results => results.map(result => ({
      name: result.name,
      url: result.url,
      env: result.env
    })));
}

function getLocalDatabase() {
  return getAllDatabases().then(dbs => {
    return [
      {
        name: 'FH_LOCAL',
        url: 'mongodb://localhost:27017/FH_LOCAL',
        env: 'LOCAL'
      }
    ].concat(dbs);
  });
}

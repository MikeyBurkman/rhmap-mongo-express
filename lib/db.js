'use strict';

const mongo = require('rhmap-mongodb');
const config = require('./config');

const collection = mongo.collection('databases');

const init = Promise.resolve().then(() => {
  if (!config.isLocal()) {
    return null; // No
  }

  return collection
    .count({
      name: 'FH_LOCAL'
    })
    .then((count) => {
      if (count === 0) {
        console.log('Adding default local database...');
        return addDatabase('FH_LOCAL', 'LOCAL', 'mongodb://localhost:27017/FH_LOCAL');
      } else {
        return null; // No action
      }
    });
});

module.exports = {
  getInstance: () => mongo.db,
  getAllDatabases: () => init.then(getAllDatabases),
  addDatabase: addDatabase,
  deleteDatabase: deleteDatabase,
  flagDbLoaded: flagDbLoaded
};

function getAllDatabases() {
  return collection.find().then((cursor) => cursor.sort({ name: 1 }).toArray()).then((results) =>
    results.map((result) => ({
      name: result.name,
      url: result.url,
      env: result.env
    }))
  );
}

function addDatabase(name, env, url) {
  const record = {
    name: name,
    env: env,
    url: url,
    readOnlyInUse: false,
    editableInUse: false
  };
  return collection.insert(record).then(() => record);
}

function deleteDatabase(name, url) {
  return collection.remove({
    name: name,
    url: url
  });
}

function flagDbLoaded(name, url, readOnly, isInUse) {
  const field = readOnly ? 'readOnlyInUse' : 'editableInUse';
  return collection.update(
    {
      name: name,
      url: url
    },
    {
      $set: {
        [field]: isInUse
      }
    }
  );
}

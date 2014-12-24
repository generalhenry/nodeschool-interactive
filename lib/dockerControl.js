var http = require('http');
var Dockerode = require('dockerode');
var emptyPort = require('empty-port');
var thunkify = require('thunkify');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var config = require('../config');

module.exports = {
  readyContainer: readyContainer,
  createContainer: createContainer
}

var docker = new Dockerode(config.dockerOptions);
var emptyPort = thunkify(emptyPort);
docker.createContainer = thunkify(docker.createContainer);
mkdirp = thunkify(mkdirp);
rimraf = thunkify(rimraf);

function *startContainer(container) {
  var port = yield emptyPort({});
  var folder = __dirname + '/binds/' + container.id;
  yield mkdirp(folder);
  yield rimraf(folder + '/*');
  container.start = thunkify(container.start);
  yield container.start({
    Binds: [folder + ':/var/run']
  });
  yield waitForPort(folder);
  return port;
}

function *unpauseContainer(container) {
  container.unpause = thunkify(container.unpause);
  yield container.unpause();
  yield waitForPort(__dirname + '/binds/' + container.id);
}

function *waitForPort(folder) {
  var count = 1000;
  while (count-- > 0) {
    try {
      var result = yield get({ socketPath: folder + '/proxy' });
      break;
    } catch (error) {
      ignore(error);
    }
  }
  if (count < 1) {
    throw new Error('Could not connect to container');
  }
}

function get(options) {
  return function getThunk(cb) {
    setTimeout(function getAttempt () {
      var req = http.get(options);
      req.on('error', cb);
      req.on('response', function handleGetResponse(res) {
        res.on('error', cb);
        res.on('data', ignore);
        res.on('end', cb);
      });
    }, 50);
  };
}

function *readyContainer(name) {
  var container = docker.getContainer(name);
  container.inspect = thunkify(container.inspect);
  var info = yield container.inspect();
  if (!info.State.Running) {
    yield startContainer(container);
  }
  if (info.State.Paused) {
    yield unpauseContainer(container);
  }
  return container.id;
}

function *createContainer(image) {
  var container = yield docker.createContainer({
    Image: config.imagePrefix + image,
    Hostname: image,
    Tty: true,
    Volumes: {
      '/var/run': {}
    }
  });
  container.inspect = thunkify(container.inspect);
  var info = yield container.inspect();
  return info.Name;
}

function ignore() {}

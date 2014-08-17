var config = require('./config');
var Dockerode = require('dockerode');
var docker = new Dockerode(config.dockerOptions);
var emptyPort = require('empty-port');
var koa = require('koa');
var serve = require('koa-static');
var thunkify = require('thunkify');
var httpProxy = require('http-proxy');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var http = require('http');

var app = koa();
emptyPort = thunkify(emptyPort);
var proxy = httpProxy.createProxyServer({});
docker.createContainer = thunkify(docker.createContainer);
mkdirp = thunkify(mkdirp);
rimraf = thunkify(rimraf);

proxy.on('error', function(e) {
  console.log('proxy err');
  console.error(e);
});

app.use(function *(next) {
  var host = this.request.headers.host;
  if (host.split('.').length > 2) {
    var name = host.split('.').shift();
    var port;
    var container = docker.getContainer(name);
    container.inspect = thunkify(container.inspect);
    try {
      var info = yield container.inspect();
    } catch (e) {
      console.error(e);
      return next;
    }
    if (!info.State.Running) {
      try {
        yield startContainer(container);
      } catch (err) {
        console.error('fail', err);
        this.body = 'fail';
        return false;
      }
    }
    var socketPath = __dirname + '/binds/' + container.id + '/proxy'; 
    proxy.web(this.req, this.res, {
      target: {
        socketPath: socketPath
      }
    });
    this.respond = false;
  } else {
    yield next;
  }
});

app.use(serve('public'));

app.use(function *(next) {
  var image = this.request.url.replace('/', '');
  try {
    var container = yield docker.createContainer({
      Image: config.imagePrefix + image,
      Hostname: image,
      Tty: true,
      Volumes: {
        '/var/run': {}
      }
    });
  } catch (e) {
    console.error(e);
    return next;
  }
  if (config.server) {
    container.inspect = thunkify(container.inspect);
    var info = yield container.inspect();
    return this.response.redirect('http://' + info.Name + '.' + config.hostName);
  } else {
    var port = yield startContainer(container);
    return this.response.redirect('http://' + config.hostName + ':' + port);
  }
});

function *startContainer (container) {
  var port = yield emptyPort({});
  var folder = __dirname + '/binds/' + container.id;
  yield mkdirp(folder);
  yield rimraf(folder + '/*');
  container.start = thunkify(container.start);
  yield container.start({
    Binds: [folder + ':/var/run']
  });
  var count = 100000;
  while (count-- > 0) {
    try {
      var result = yield get({ socketPath: folder + '/proxy' });
      console.log('connected');
      break;
    } catch (error) {
      process.stdout.write('[');
    }
  }
  if (count < 1) {
    throw new Error('Could not connect to container');
  }
  return port;
}

function get (options) {
  return function (cb) {
    setTimeout(function () {
      var req = http.get(options);
      req.on('error', cb);
      req.on('response', function (res) {
        res.on('error', cb);
        res.on('data', function () {});
        res.on('end', cb);
      });
    }, 50);
  };
}

var server = app.listen(80);

server.on('error', function (err) {
  console.log('server error');
  console.error(err);
});

server.on('upgrade', function (req, socket, head) {
  var name = req.headers.host.split('.').shift();
  var socketPath = __dirname + '/binds/' + name + '/proxy';
  proxy.ws(req, socket, head, {
    target: {
      socketPath: socketPath     
    }
  });
  req.on('error', function (err) {
    console.log('req');
    console.error(err);
  });
});

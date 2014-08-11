var Dockerode = require('dockerode');
var docker = new Dockerode({
  socketPath: '/var/run/docker.sock'
});
var emptyPort = require('empty-port');
var koa = require('koa');
var serve = require('koa-static');
var thunkify = require('thunkify');
var request = require('co-request');
var httpProxy = require('http-proxy');

var app = koa();
emptyPort = thunkify(emptyPort);
var proxy = httpProxy.createProxyServer({});

proxy.on('error', function(e) {
  console.error(e);
});

app.use(function *(next) {
  var host = this.request.headers.host;
  if (host.split('.').length > 2) {
    var name = host.split('.').shift();
    var port;
    var container = docker.getContainer(name);
    container.inspect = thunkify(container.inspect);
    var info = yield container.inspect();
    if (info.State.Running) {
      port = info.HostConfig.PortBindings['80/tcp'][0].HostPort;
    } else {
      port = yield emptyPort({});
      container.start = thunkify(container.start);
      yield(container.start({
        "PortBindings": {
          "80/tcp": [{
            "HostPort": port.toString()
          }]
        }
      }));
    }
    var count = 1000;
    while (count-- > 0) {
      try {
        var result = yield request('http://localhost:' + port);
        break;
      } catch (error) {}
    }
    if (count < 1) {
      return next;
    }
    var web = proxy.web(this.req, this.res, {
      target: 'http://localhost:' + port
    });
    this.respond = false;
  } else {
    yield next;
  }
});

app.use(serve('public'));

app.use(function *() {
  var image = this.request.url.replace('/', '');
  var container = yield docker.createContainer({
    Image: 'nodeschool/' + image,
    Hostname: image,
    Tty: true,
    ExposedPorts: {
      "80/tcp": {}
    }
  });
  container.inspect = thunkify(container.inspect);
  var info = yield container.inspect();
  return this.response.redirect('http://' + info.Name + '.generalhenry.com');
});

var server = app.listen(80);

server.on('upgrade', function (req, socket, head) {
  var name = req.headers.host.split('.').shift();
  var container = docker.getContainer(name);
  container.inspect(function (err, info) {
    if (err) {
      console.error(err);
      return socket.end();
    } else {
      var port = info.HostConfig.PortBindings['80/tcp'][0].HostPort;
      proxy.ws(req, socket, head, {
        target: 'http://localhost:' + port
      });
    }
  });
});

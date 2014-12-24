var path = require('path');
var koa = require('koa');
var serve = require('koa-static');
var config = require('../config');
var proxy = require('./proxy');
var dockerControl = require('./dockerControl');

var app = module.exports = koa();

app.use(function *proxyWorkshopContainers(next) {
  var host = this.request.headers.host;
  // if subdomain
  if (host.split('.').length > 2) {
    var name = host.split('.').shift();
    var id = yield dockerControl.readyContainer(name);
    var socketPath = path.join(__dirname, 'binds', id, 'proxy'); 
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

app.use(function *createContainers(next) {
  var image = path.basename(this.request.url);
  try {
    var containerName = yield dockerControl.createContainer(image);
    return this.response.redirect('http://' + containerName + '.' + config.hostName);
  } catch (err) {
    console.log('container create error', 'image', image);
    console.error(err);
    return next;
  }
});





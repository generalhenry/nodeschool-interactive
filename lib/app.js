var path = require('path');
var koa = require('koa');
var serve = require('koa-static');
var config = require('../config');
var proxy = require('./proxy');
var dockerControl = require('./dockerControl');

var app = module.exports = koa();

proxy.on('proxyReq', function(proxyReq, req, res, options) {
  console.log(1);
  if (req.chop) {
    var urlParts = req.url.split('/');
    proxyReq.url = '/' + urlParts.slice(2).join('/');
    console.log('url', proxyReq.url);
  }
});

app.use(function *proxyWorkshopContainers(next) {
  var host = this.request.headers.host;
  // if subdomain
  if (host.split('.').length > 2) {
    var name = host.split('.').shift();
    yield dockerControl.readyContainer(name);
    var socketPath = path.join(__dirname, '../binds', name, 'proxy'); 
    proxy.web(this.req, this.res, {
      target: {
        socketPath: socketPath
      }
    }, function (err) {
      console.log('web proxy error');
      console.error(err);
    });
    this.respond = false;
    return true;
  }
  var urlParts = this.request.url.split('/');
  if (urlParts.length > 1) {
    try {
      var name = urlParts[1];
      yield dockerControl.readyContainer(name);
      var socketPath = path.join(__dirname, '../binds', name, 'proxy'); 
      this.req.chop = true;
      proxy.web(this.req, this.res, {
        target: {
          socketPath: socketPath
        }
      }, function (err) {
        console.log('web proxy error');
        console.error(err);
      });
      this.respond = false;
      return true;
    } catch (err) {
      console.log('single guy error');
      console.error(err);
    }
  }
  yield next;
});

app.use(serve('public'));

app.use(function *createContainers(next) {
  var image = path.basename(this.request.url);
  try {
    var name = yield dockerControl.createContainer(image);
    if (config.hostName) {
      return this.response.redirect('http://' + name + '.' + config.hostName);
    } else {
      return this.response.redirect('http://' + this.request.host + name);
    }
  } catch (err) {
    console.log('container create error', 'image', image);
    console.error(err);
    return next;
  }
});





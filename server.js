var http = require('http');
var path = require('path');
var app = require('./lib/app');
var proxy = require('./lib/proxy');

var portList = [80, 2000, 3000, 4000, 5000, 8000, 8080, 12491, 12492];

portList.forEach(attachToPort);

function attachToPort (port) {
  var server = http.createServer(app.callback());

  server.listen(port); 
  server.on('error', handleServerError);
  server.on('upgrade', handleUpgrade);

  function handleServerError (err) {
    console.log('server error', 'port:', port);
    console.error(err);
  }
}

function handleUpgrade (req, socket, head) {
  var host = req.headers.host;
  // if subdomain
  if (host.split('.').length > 2) {
    var name = host.split('.').shift();
    var socketPath = path.join(__dirname, 'binds', name, 'proxy');

    proxy.ws(req, socket, head, {
      target: {
        socketPath: socketPath     
      }
    });
    req.on('error', handleRequestErrors);
    
    function handleRequestErrors (err) {
      console.log('websocket request error', 'name:', name);
      console.error(err);
    }
  }
}
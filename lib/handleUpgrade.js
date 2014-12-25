var proxy = require('./proxy');

module.exports = handleUpgrade;

function handleUpgrade (req, socket, head) {
  var host = req.headers.host;
  // if subdomain
  if (host.split('.').length > 2) {
    var name = host.split('.').shift();
    var socketPath = path.join(__dirname, '../binds', name, 'proxy');

    proxy.ws(req, socket, head, {
      target: {
        socketPath: socketPath     
      }
    }, handleRequestErrors);
    req.on('error', handleRequestErrors);

    function handleRequestErrors (err) {
      console.log('websocket request error', {
        name: name,
        socketPath: socketPath
      });
      console.error(err);
    }
  }
}
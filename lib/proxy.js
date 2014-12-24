var httpProxy = require('http-proxy');

var proxy = module.exports = httpProxy.createProxyServer({});

proxy.on('error', handleProxyError);

function handleProxyError(err) {
  console.log('proxy error');
  console.error(err);
}
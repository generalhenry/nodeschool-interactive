var express = require('express');
var Dockerode = require('dockerode');
var docker = new Dockerode({
  socketPath: '/var/run/docker.sock'
});
var emptyPort = require('empty-port');
var async = require('async');

var app = express();

app.use(express.static('./public'));

app.get('/:module', function (req, res, next) {
  var container;
  var port;
  async.waterfall([
    function createContainer (done) {
       docker.createContainer({
         Image: 'nodeschool/' + req.params.module,
         Hostname: req.params.module,
         Tty: true,
         ExposedPorts: {
           "80/tcp": {}
         }
       }, done);
    },
    function findPort (c, done) {
      container = c;
      emptyPort({}, done);
    },
    function startContainer (p, done) {
      console.log('port', p);
      port = p.toString();
      container.start({
        "PortBindings": {
          "80/tcp": [{
            "HostPort": port
          }]
        }
      }, done);
    },
    function delay (data, done) {
      setTimeout(done, 500);
    }
  ], function (err) {
    if (err) {
      next(err);
    } else {
      res.redirect('http://generalhenry.com:' + port);
    }
  });
});

app.listen(80);

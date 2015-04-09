var memwatch = require('memwatch');
var heapdump = require('heapdump');

var fs = require('fs');
var path = require('path');

var DummyCollection = require('./lib/dummydb').Collection;
var reformFilter = require('./lib/dummydb').reformFilter;

var logger = require('./lib/logger');

var utils = require('./lib/utils');
var config = require('./lib/config');

var Oplog = require('mongo-oplog');
var Bus = require('./plugins/bus').Bus;

var webroot = path.join(__dirname, (config.web||{}).site||'/web/site');
var server = require('./lib/server');
var sift = require('sift');

var Handler = require('./lib/handler').Handler;

var reIsFunction = /function\s*[]*\s\(([^)]+)\)*/;
var getFuncInfo = function(source){
  var args = /\(([^)]+)/.exec(source);
  var res = {};
  if (args[1]) {
    res.args = args[1];
  }
  res.body = source.replace(reIsFunction, '');
  return res;
};

logger.info('Static content folder: '+webroot);
server.path(webroot);

try{
  fs.mkdirSync('./logs');
}catch(e){}

/*
memwatch.on('leak', function(info) {
  logger.error(info);
  var file = './logs/' + process.pid + '-' + Date.now() + '.heapsnapshot';
  heapdump.writeSnapshot(file, function(err){
    if(err){
      logger.error(err);
    }else{
      logger.error('Wrote snapshot: ' + file);
    }
  });
});
//*/

var handler = new Handler(config);

var listWindows = function(request, reply){
  reply(Object.keys(handler.windows));
};

var getWindow = function(request, reply){
  var windowName = request.params.window;
  if(windowName){
    var window = handler.windows[windowName];
    if(!window){
      return reply(null);
    }
    return reply({
      name: window.name,
      maxEntries: window.maxEntries,
      pattern: window.pattern,
      stats: window.stats,
      buckets: window.buckets.map(function(bucket){
        return {
          key: bucket.key,
          stats: bucket.stats,
          size: bucket.items.length
        };
      })
    });
  }
  var window = handler.window;
  return reply({
    name: window.name,
    maxEntries: window.maxEntries,
    pattern: window.pattern,
    stats: window.stats,
    buckets: window.buckets.map(function(bucket){
      return {
        key: bucket.key,
        stats: bucket.stats,
        size: bucket.items.length
      };
    })
  });
};

var getWindowBucket = function(request, reply){
  var windowName = request.params.window;
  var bucket = request.params.bucket;
  if(windowName){
    var window = handler.windows[windowName];
    if(window){
      if(bucket === 'latest'){
        bucket = window.buckets.length?window.buckets[window.buckets.length-1].key:false;
      }
      if(bucket === 'earliest'){
        bucket = (window.buckets[0]||{}).key;
      }
      if(!bucket){
        return reply(null);
      }
      return reply(window.getBucket(bucket));
    }
    return reply(null);
  }
  return reply(handler.window);
};

server.route([
    {
      method: 'GET',
      path: '/{param*}',
      handler: {
        directory: {
          path: webroot
        }
      }
    },
    {
      method: 'GET',
      path: '/api/v1/windows',
      handler: listWindows
    },
    {
      method: 'GET',
      path: '/api/v1/window',
      handler: getWindow
    },
    {
      method: 'GET',
      path: '/api/v1/window/{window}',
      handler: getWindow
    },
    {
      method: 'GET',
      path: '/api/v1/window/{window}/bucket/{bucket}',
      handler: getWindowBucket
    },
  ]);

var bus = new Bus(config.bus);

bus.on('started', function(){
  logger.info('Attached to message bus.');
});

bus.on('event', function(data){
  handler.push(data);
});

bus.on('stopped', function(){
  logger.info('Detached from message bus.');
});

bus.start();

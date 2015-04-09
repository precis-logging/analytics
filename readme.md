Precis Analytics
================

Performs analytics on flowing logs and notifies/alerts on threshold criteria.

Currently provides narrow windows of bucketed data on set intervals.

Configuration
===

Basic configuration file should be put in ./config/config.js

Something similar to the following where the expected data format is like the following:

```javascript
{
  time: Date(),
  req: {
    ...
  }
  res: {
    statusCode: Number,
    payload: {...}||String||Number
    ...
  },
  url: String,
  duration: Number,
  direction: String, // inbound is into the server, outbound is from the server to another server
}
```

The config could look as follows:

```javascript
var defaults = require('../lib/utils').defaults;
var request = require('request');

var standardWindow = function(options){
  return defaults(options, {
    bucket: {
      stats: {
        max: {
          calc: 'max',
          field: 'duration'
        },
        min: {
          calc: 'min',
          field: 'duration'
        },
        count: {
          calc: 'count',
          field: 'duration'
        },
        total: {
          calc: 'sum',
          field: 'duration'
        },
        statusCodes: {
          field: 'res.statusCode',
          calc: function(curr, val){
            var codes = curr || {};
            codes[val] = (codes[val] || 0) + 1;
            return codes;
          }
        }
      },
      actions: [
        // see Window action below, the only
        // difference is that the do handler
        // will get an info object that contains
        //   rec - the record being processed
        //   bucket - the bucket that got the record
      ]
    },
    stats: {
      max: {
        calc: 'max',
        field: 'stats.max'
      },
      min: {
        calc: 'min',
        field: 'stats.min'
      },
      count: {
        calc: 'count',
        field: 'stats.count'
      },
      total: {
        calc: 'sum',
        field: 'stats.total'
      },
      statusCodes: {
        field: 'stats.statusCodes',
        calc: function(curr, statusCodes){
          var codes = curr || [];
          Object.keys(statusCodes||{}).forEach(function(code){
            if(codes.indexOf(code)===-1){
              codes.push(code);
            }
          });
          return codes;
        }
      }
    }
  });
};

module.exports = {
  default: {
    web: {
      port: 9292
    },
    bus: {
      connectionString: "mongodb://.../ui-logs?replicaSet=1",
      collection: "logs"
    },
    windows: [
      standardWindow({
        // Give the window a name
        name: 'All Inbound Traffic',
        // Set the pattern that the window records
        pattern: {
          direction: 'inbound',
          'res.statusCode': {$exists: true}
        },
        // Setup actions to take when data on the window
        // changes
        actions: [
          {
            when: {
              'req.rec.duration': {
                  $gte: 1000
                }
            }
            do: function(info){
              /*
                info.window contains the window
                info.rec contains the record just submitted

                The this object is a local scope, it can be
                specified in the action setup (as it is here)
                or a default empty object will be provided if
                it isn't provided.

                Use this to contain any information or state
                you need stored between runs of the action
                handler.
              */
              var dt = new Date();
              var time = dt.getTime();
              // only send notifications if there hasn't been any in an hour since the last incident
              if(!this.lastNotified || (time - this.lastNotified > 1000 * 60 * 60)){
                // do something like send out a notification
                this.request({
                    url: 'http://.../',
                    method: 'POST',
                    body: rec
                  }, function(){});
              }
              this.lastNotified = time;
            },
            scope: {
              request: request
            }
          }
        ]
      }),
      standardWindow({
        name: 'All Outbound Traffic',
        pattern: {
          direction: 'outbound',
          'res.statusCode': {$exists: true}
        },
      }),
      standardWindow({
        // Use a function to calculate the name of the window,
        // create new windows when new data becomes available.
        key: function(data){
          var match = /^(http:|https:)\/\/([^/:]+)/i.exec(data.url);
          var url = match[2];
          return url;
        },
        pattern: {
          direction: 'outbound',
          'res.statusCode': {$exists: true}
        },
      }),
    ]
  },
  development: {
  },
  release: {
  },
  stage: {
    bus: {
      connectionString: "mongodb://.../ui-logs?replicaSet=1",
      collection: "logs"
    },
  },
};
```

Test Script
===

This is a pretty comprehensive test script, of course if you use the loop
to generate random data you might not hit everything.  So there is also code
that generates data that will hit everything.

```javascript
var Handler = require('./lib/handler').Handler;

var handler = new Handler({
  windows: [
    {
      name: 'All Outbound Traffic',
      pattern: {
        direction: 'outbound',
        'res.statusCode': {$exists: true}
      },
      bucket: {
        stats: {
          max: {
            calc: 'max',
            field: 'duration'
          },
          min: {
            calc: 'min',
            field: 'duration'
          },
          count: {
            calc: 'count',
            field: 'duration'
          },
          total: {
            calc: 'sum',
            field: 'duration'
          },
          statusCodes: {
            field: 'res.statusCode',
            calc: function(curr, val){
              var codes = curr || {};
              codes[val] = (codes[val] || 0) + 1;
              return codes;
            }
          }
        }
      },
      stats: {
        max: {
          calc: 'max',
          field: 'stats.max'
        },
        min: {
          calc: 'min',
          field: 'stats.min'
        },
        count: {
          calc: 'count',
          field: 'stats.count'
        },
        total: {
          calc: 'sum',
          field: 'stats.total'
        },
        statusCodes: {
          field: 'stats.statusCodes',
          calc: function(curr, statusCodes){
            var codes = curr || [];
            Object.keys(statusCodes||{}).forEach(function(code){
              if(codes.indexOf(code)===-1){
                codes.push(code);
              }
            });
            return codes;
          }
        }
      }
    },
    {
      name: function(data){
        var match = /^(http:|https:)\/\/([^/:]+)/i.exec(data.url);
        var url = match[2];
        return url;
      },
      pattern: {
        direction: 'outbound',
        'res.statusCode': {$exists: true}
      },
      bucket: {
        stats: {
          max: {
            calc: 'max',
            field: 'duration'
          },
          min: {
            calc: 'min',
            field: 'duration'
          },
          count: {
            calc: 'count',
            field: 'duration'
          },
          total: {
            calc: 'sum',
            field: 'duration'
          },
          statusCodes: {
            field: 'res.statusCode',
            calc: function(curr, val){
              var codes = curr || {};
              codes[val] = (codes[val] || 0) + 1;
              return codes;
            }
          }
        },
        actions: [
          {
            when: {
              'rec.res.statusCode': 404
            },
            do: function(info){
              var rec = info.rec;
              console.log('res.statusCode', this.util.inspect(rec, {colors: true, depth: null, showHidden: true}));
            },
            scope: {
              util: require('util')
            }
          }
        ]
      },
      stats: {
        max: {
          calc: 'max',
          field: 'stats.max'
        },
        min: {
          calc: 'min',
          field: 'stats.min'
        },
        count: {
          calc: 'count',
          field: 'stats.count'
        },
        total: {
          calc: 'sum',
          field: 'stats.total'
        },
        statusCodes: {
          field: 'stats.statusCodes',
          calc: function(curr, statusCodes){
            var codes = curr || [];
            Object.keys(statusCodes||{}).forEach(function(code){
              if(codes.indexOf(code)===-1){
                codes.push(code);
              }
            });
            return codes;
          }
        }
      },
      actions: [
        {
          when: {
            'window.stats.max': {$gt: 0}
          },
          do: function(info){
            var window = info.window;
            if(!this.signaled){
              console.log('stats.max', window.stats);
            }else{
              console.log('stats.max Already signaled ', this.signaled);
            }
            this.signaled = (this.signaled || 0)+1;
            if(this.signaled>2){
              this.signaled = 0;
            }
          }
        }
      ]
    }
  ]
});

var util = require('util');

var t1 = new Date("2015-04-06T20:02:48.664Z");
var t2 = new Date("2015-04-06T20:02:49.664Z");
var t3 = new Date("2015-04-06T20:02:50.664Z");

var slots = [t1, t2, t3];
var codes = [200, 404, 201, 401, 500];

var data = [];

for(var i=0; i<10; i++){
  var time = slots[Math.floor(slots.length * Math.random())];
  var statusCode = codes[Math.floor(codes.length * Math.random())];
  console.log('PUSHING: ', time, statusCode);
  handler.push({
    time: time,
    res: {
      statusCode: statusCode,
      payload: 'Test '+i
    },
    index: i,
    url: 'http://foo/bar/'+i,
    duration: Math.random()*1000,
    direction: 'outbound',
  });
}

/*
data.push = function(item){
  item.index = this.length;
  item.url = 'http://foo/bar/'+item.index;
  item.duration = Math.random()*1000;
  item.direction = 'outbound';
  Array.prototype.push.call(this, item)
};

data.push({
  time: t3,
  res: {
    statusCode: 200,
    payload: 'test 1'
  }
});

data.push({
  time: t2,
  res: {
    statusCode: 200,
    payload: 'test 2'
  }
});

data.push({
  time: t3,
  res: {
    statusCode: 404,
    payload: 'test 3'
  }
});

data.push({
  time: t1,
  res: {
    statusCode: 200,
    payload: 'test 4'
  }
});

data.forEach(function(item){
  handler.push(item);
});

*/

//console.log(util.inspect(handler, {depth: null, showHidden: true, colors: true}));
//console.log(Object.keys(handler.windows));
```

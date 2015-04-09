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
        name: 'All Inbound Traffic',
        pattern: {
          direction: 'inbound',
          'res.statusCode': {$exists: true}
        },
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
              */
              var dt = new Date();
              var time = dt.getTime();
              // only send notifications if there hasn't been any in an hour since the last incident
              if(!this.lastNotified || (time - this.lastNotified > 1000 * 60 * 60)){
                // do something like send out a notification
                request({
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

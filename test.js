var Handler = require('./lib/handler').Handler;

var handler = new Handler({
  window: {
    default: {
      bucket: {
        stats: {
          test: function(curr, val){
            console.log('stats.test', arguments);
          },
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
      }
    }
  },
  windows: [
    {
      name: 'Foo by Bar',
      pattern: /foo\/bar\/([^/]+)/,
      bucket: {
        stats: {
          testFoo: function(curr, val){
            console.log('stats.testFoo', arguments);
          },
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
      }
    }
  ]
});

var util = require('util');

var t1 = new Date("2015-04-06T20:02:48.664Z");
var t2 = new Date("2015-04-06T20:02:49.664Z");
var t3 = new Date("2015-04-06T20:02:50.664Z");

var data = [];

data.push = function(item){
  item.index = this.length;
  item.url = 'http://foo/bar/'+item.index;
  item.duration = Math.random()*1000;
  Array.prototype.push.call(this, item)
};

data.push({
  time: t3,
  req: {
    statusCode: 200,
    payload: 'test 1'
  }
});

data.push({
  time: t2,
  req: {
    statusCode: 200,
    payload: 'test 2'
  }
});

data.push({
  time: t3,
  req: {
    statusCode: 404,
    payload: 'test 3'
  }
});

data.push({
  time: t1,
  req: {
    statusCode: 200,
    payload: 'test 4'
  }
});

data.forEach(function(item){
  handler.push(item);
});

console.log(util.inspect(handler, {depth: null, showHidden: true, colors: true}));
//console.log(Object.keys(handler.windows));

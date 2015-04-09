var utils = require('./utils');
var Reform = require('prodio-reform').Reform;
var sift = require('sift');

var Stats = require('./stats');

var ActionsList = function(options){
  var opts = utils.defaults(options, {actions: []});
  this.actions = opts.actions.map(function(item){
    return {
      when: sift(item.when),
      do: item.do,
      scope: item.scope || {}
    };
  });
};

ActionsList.prototype.check = function(data){
  var aData = [data];
  this.actions.forEach(function(action){
    if(action.when(aData)){
      action.do.call(action.scope, data);
    }
  });
};

var Bucket = function(options){
  if(typeof(options)==='string'){
    options = {
      name: arguments[0],
      key: arguments[1]
    }
  }
  this.timeCode = (new Date(options.key+'.000Z')).getTime();
  this.name = options.name;
  this.key = options.key;
  this.items = [];
  this.calcs = Stats.enrichers(options.stats||{});
  this.stats = {};
  this.actions = new ActionsList(options);
};

Bucket.prototype.isFor = function(key){
  return key === this.key;
};

Bucket.prototype.timeOffset = function(key){
  var diff = this.timeCode - (new Date(key+'.000Z')).getTime();
  if(diff === 0){
    return 0;
  }
  if(diff < 0){
    return -1;
  }
  if(diff > 0){
    return 1;
  }
};

Bucket.prototype.isLess = function(key){
  return this.timeOffset(key)<0?true:false;
};

Bucket.prototype.isGreater = function(key){
  return this.timeOffset(key)>0?true:false;
};

Bucket.prototype.push = function(data){
  this.items.push(data);
  this.calcs.forEach(function(info){
    this.stats[info.name] = info.calc(this.stats[info.name], data);
  }.bind(this));
  this.actions.check({
    bucket: this,
    rec: data
  });
  return this;
};

var Window = function(name, options){
  if(typeof(name)==='object'){
    options = name;
    name = options.name;
  }
  var opts = utils.defaults({max: 60}, options);
  this.name = name;
  this.maxEntries = opts.max;
  this.buckets = [];
  this.pattern = opts.pattern||{};
  this.options = opts;
  this.transform = opts.transform || function(d){
    return d;
  };
  if(typeof(this.transform)==='object'){
    this.transform = (function(){
      var r = new Reform(this.transform);
      return function(d){
        return r.reform(d);
      };
    }.bind(this))();
  }
  this.calcs = Stats.enrichers(opts.stats||{});
  this.stats = {};
  this.actions = new ActionsList(opts);
};

Window.prototype.calcStats = function(){
  this.stats = {};
  this.buckets.forEach(function(bucket){
    this.calcs.forEach(function(info){
      this.stats[info.name] = info.calc(this.stats[info.name], bucket);
    }.bind(this));
  }.bind(this));
};

Window.prototype.checkCleanBuckets = function(){
  while(this.buckets.length > this.maxEntries){
    this.buckets.shift();
  }
};

Window.prototype.getBucket = function(key, forceCreate){
  var bucket = this.buckets.length?this.buckets[this.buckets.length-1]:false;
  if(!bucket && forceCreate){
    bucket = new Bucket(utils.defaults(this.options.bucket, {name: this.name, key: key}));
    this.buckets.push(bucket);
    return bucket;
  }
  if(bucket.isFor(key)){
    return bucket;
  }
  if(bucket.isLess(key)){
    bucket = new Bucket(utils.defaults(this.options.bucket, {name: this.name, key: key}));
    this.buckets.push(bucket);
    this.checkCleanBuckets();
    return bucket;
  }
  var i = this.buckets.length-2;
  if(i===-1 && this.buckets[0].isGreater(key)){
    bucket = new Bucket(utils.defaults(this.options.bucket, {name: this.name, key: key}));
    this.buckets.unshift(bucket);
    return bucket;
  }
  while(i>=0){
    if(this.buckets[i].isFor(key)){
      return this.buckets[i];
    }
    if(this.buckets[i+1] && this.buckets[i].isLess(key) && this.buckets[i+1].isGreater(key)){
      bucket = new Bucket(utils.defaults(this.options.bucket, {name: this.name, key: key}));
      this.buckets.splice(i+1, 0, bucket);
      this.checkCleanBuckets();
      return bucket;
    }
    if(i===0 && this.buckets.length < this.maxEntries && this.buckets[i].isGreater(key)){
      bucket = new Bucket(utils.defaults(this.options.bucket, {name: this.name, key: key}));
      this.buckets.unshift(bucket);
      return bucket;
    }
    i--;
  }
  return null;
};

Window.prototype.push = function(data){
  var key = data.time.toISOString().substr(0, 19);
  var bucket = this.getBucket(key, true);
  if(bucket){
    bucket.push(this.transform(data));
  }
  this.calcs.forEach(function(info){
    this.stats[info.name] = info.calc(this.stats[info.name], data);
  }.bind(this));
  this.calcStats();
  this.actions.check({
    window: this,
    rec: data
  });
  return this;
};

var Handler = function(cfg){
  var config = utils.defaults({windows: []}, cfg);
  this.windowOptions = config.window || {};
  this.windows = {
  };
  this.customWindows = config.windows||[];
  config.windows.forEach(function(windowConfig){
    if(typeof(config.name)==='string'){
      this.windows[config.name] = new Window(utils.defaults(windowConfig, this.windowOptions.default));
    }
  });
  this.customWindows.forEach(function(window){
    window.pattern = sift(window.pattern);
  });
};

Handler.prototype.getWindows = function(data){
  var aData = [data];
  var matchedWindows = this.customWindows.filter(function(window){
    return window.pattern(aData);
  });
  var windows = matchedWindows.map(function(windowConfig){
    var name = windowConfig.name || windowConfig.key;
    if(typeof(name)==='function'){
      name = name(data);
    }
    if(!this.windows[name]){
      this.windows[name] = new Window(name, utils.defaults(windowConfig, this.windowOptions.default));
    }
    return this.windows[name];
  }.bind(this));
  return windows;
};

Handler.prototype.push = function(data){
  this.getWindows(data).forEach(function(window){
    window.push(data);
  });
  return this;
};

module.exports = {
  Window: Window,
  Bucket: Bucket,
  Handler: Handler
};

var utils = require('./utils');
var Reform = require('prodio-reform').Reform;

var Stats = require('./stats');

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
  this.pattern = opts.pattern||opts.name;
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
  return this;
};

var Handler = function(cfg){
  var config = utils.defaults({windows: []}, cfg);
  this.windowOptions = config.window || {};
  this.window = new Window('*', this.windowOptions.default);
  this.windows = {
    '*': this.window
  };
  this.customWindows = config.windows.map(function(windowConfig){
    return new Window(windowConfig);
  });
  this.customWindows.forEach(function(window){
    this.windows[window.name] = window;
  }.bind(this));
};

Handler.prototype.getwindow = function(name, forceCreate){
  if(!this.windows[name] && forceCreate){
    this.windows[name] = new Window(name, utils.defaults(this.windowOptions[name], this.windowOptions.default));
  }
  return this.windows[name];
};

Handler.prototype.getcustomWindows = function(url){
  var windows = this.customWindows.filter(function(window){
    return window.pattern && window.pattern.exec(url);
  });
  return windows;
};

Handler.prototype.push = function(data){
  if(data && data.duration){
    this.window.push(data);
  }
  if(data && data.url && data.url.match(/^(http:|https:)\/\//i)){
    var match = /^(http:|https:)\/\/([^/:]+)/i.exec(data.url);
    var url = match[2];
    this.getwindow(url, true).push(data);
  }
  this.getcustomWindows(data.url).forEach(function(window){
    window.push(data);
  });
};

module.exports = {
  Window: Window,
  Bucket: Bucket,
  Handler: Handler
};

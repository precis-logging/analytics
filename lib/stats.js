var extend = require('./utils').extend;

var getValue = function(path, src){
  var o = src;
  var parts = path.split('.');
  while(o && parts.length>0){
    o = o[parts.shift()];
  }
  return o;
};

var makeStatFilter = function(stat, enforceExists){
  var res = {};
  var keys = Object.keys(stat);
  keys.forEach(function(key){
    var value = stat[key];
    var type = typeof(value);
    if(key === '$filter'){
      if(enforceExists){
        Object.keys(value).forEach(function(key){
          return res[key]=value[key];
        });
      }
      return;
    }
    if(type==='string'){
      return res[key]=value;
    }
    if(type==='object'){
      if(value.field){
        key = value.field;
      }
      if(value.matches){
        return res[key]=value.matches;
      }
      if(enforceExists){
        return res[key]={$exists: true};
      }
    }
  });
  return res;
};

var defaultHandlers = {
  min: function(c, v){
    if(!c){
      return v;
    }
    if(c > v){
      return v;
    }
    return c;
  },
  max: function(c, v){
    if(!c){
      return v;
    }
    if(c < v){
      return v;
    }
    return c;
  },
  sum: function(c, v){
    if(!c){
      return parseFloat(v)||0;
    }
    return c += parseFloat(v)||0;
  },
  count: function(c){
    if(!c){
      return 1;
    }
    return c+1;
  }
};

var getStatFunctions = function(funcs){
  return funcs.map(function(agg){
    var type = typeof(agg);
    if(type==='string'){
      if(defaultHandlers[agg]){
        return {key: agg, f: defaultHandlers[agg]};
      }
      throw new Error('Unknown aggreagtion type: '+agg);
    }
    if(type==='object'){
      if(typeof(agg.name)==='string'&&typeof(agg.calc)==='function'){
        return {
            key: agg.name,
            f: agg.calc
          };
      }
    }
    return {};
  });
};

var makeStatEnricher = function(info){
  var type = typeof(info);
  if(type === 'function'){
    return info;
  }
  if(type === 'object'){
    if(info.calc && info.field){
      var calc = typeof(info.calc)==='function'?info.calc:defaultHandlers[info.calc];
      if(!calc){
        throw new Error('Unknown stat calculation: '+info.calc);
      }
      return function(curr, src){
        return calc(curr, getValue(info.field, src));
      };
    }
  }
  throw new Error('Unknown stat type: '+JSON.stringify(info));
};

var makeStatsEnrichers = function(stats){
  return Object.keys(stats).map(function(key){
    return {
      name: key,
      calc: makeStatEnricher(stats[key])
    };
  });
};

module.exports = {
  enricher: makeStatEnricher,
  enrichers: makeStatsEnrichers,
  filter: makeStatFilter,
  defaults: defaultHandlers
};

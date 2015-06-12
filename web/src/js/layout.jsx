var React = require('react');
var Loader = require('../lib/loader');
var Support = require('../lib/support');
var Charts = require('d3rrc');
var LineChart = Charts.LineChart;
var d3 = require('d3');

var windowsAPI = '/api/v1/windows';

var EndpointSelector = React.createClass({
  getInitialState: function(){
    return {
      items: []
    };
  },
  componentDidMount: function(){
    Loader.get(windowsAPI, function(err, list){
      if(err){
        return alert(err);
      }
      if(this.props.onLoaded){
        var value = list[0];
        this.props.onLoaded(value.value || value.key || value);
      }
      return this.setState({
        items: list
      });
    }.bind(this));
  },
  render: function(){
    var items = (this.state.items||[]).map(function(item, index){
      var text = item.key || item.value || item;
      var value = item.value || item.key || item;
      return index===2?<option key={value} value={value}>{text}</option>:<option key={value} value={value}>{text}</option>;
    });
    return (
      <select ref="select" onChange={this.props.onChange}>
        {items}
      </select>
    )
  }
});

var DurationVis = React.createClass({
  render(){
    var data = this.props.data||{buckets: [], stats: {}};
    var series = [{
        name: 'Duration',
        values: data.buckets.map(function(bucket){
          return {
            x: new Date(bucket.key+'.000Z'),
            y: parseInt(bucket.stats.max)||0
          }
        })||[]
      }];
    var seriesNames = function(d){
      return d.name;
    };
    var seriesValues = function(d){
      return d.values||[];
    };
    var pointNames = function(d){
      return d.x.toISOString();
    };
    var pointValues = function(d){
      return d?d.y:0;
    };
    var pointIndexes = function(d){
      return d?d.x:0;
    };
    var color = d3.scale.category10();
    var enterPoints = function(points){
        points
          .append("circle")
          .attr("stroke", function(d){
            return color(seriesNames(this.parentNode.parentNode.__data__));
          })
          .attr("r", 5)
          .attr("fill", "white").attr("fill-opacity", .5)
          .append('svg:title')
      };
    var updatePoints = function(points){
      points.selectAll('circle title')
      .text(function(d, s, i){
        return Math.round(data.buckets[i].stats.max)+'ms';
      });
    };

    return (
        <LineChart
          chart-height={this.props.height}
          chart-seriesNames={seriesNames}
          chart-seriesValues={seriesValues}
          chart-pointNames={pointNames}
          chart-pointValues={pointValues}
          chart-pointIndexes={pointIndexes}
          chart-lineInterpolation="linear"
          chart-color={color}
          chart-enterPoints={enterPoints}
          chart-updatePoints={updatePoints}
          data={series}
          />
    );
  }
});

var StatusVis = React.createClass({
  render(){
    var data = this.props.data||{buckets: [], stats: {}};
    var codes = (data.stats.statusCodes||[]).sort();
    var series = codes.map(function(code){
      return {
        name: code,
        values: data.buckets.map(function(bucket){
          return {
            x: new Date(bucket.key+'.000Z'),
            y: parseInt(bucket.stats.statusCodes[code]||0)||0,
            count: bucket.stats.statusCodes[code]
          }
        })
      };
    });

    var seriesNames = function(d){
      return d.name;
    };
    var seriesValues = function(d){
      return d.values||[];
    };
    var pointNames = function(d){
      return d.x.toISOString();
    };
    var pointValues = function(d){
      return d?d.y:0;
    };
    var pointIndexes = function(d){
      return d?d.x:0;
    };

    var color = d3.scale.category10();
    var enterPoints = function(points){
        points
          .append("circle")
          .attr("stroke", function(d){
            return color(seriesNames(this.parentNode.parentNode.__data__));
          })
          .attr("r", 5)
          .attr("fill", "white").attr("fill-opacity", .5)
          .append('svg:title')
      };
    var updatePoints = function(points){
        points.selectAll('circle title')
          .text(function(d, s, i){
            return (d.count||0)+' transactions';
          });
      };

    return (
        <LineChart
          chart-height={this.props.height}
          chart-seriesNames={seriesNames}
          chart-seriesValues={seriesValues}
          chart-pointNames={pointNames}
          chart-pointValues={pointValues}
          chart-pointIndexes={pointIndexes}
          chart-lineInterpolation="linear"
          chart-color={color}
          chart-enterPoints={enterPoints}
          chart-updatePoints={updatePoints}
          data={series}
          />
    );
  }
});

var Vis = React.createClass({
  render(){
    var data = this.props.data;
    var height = this.props.height || document.body.clientHeight;
    var charts = data?<div>
            <StatusVis data={data} height={height*0.65}/>
            <DurationVis data={data} height={height*0.3}/>
          </div>:<div />;
    return(
      <div>
        {charts}
      </div>
    );
  }
});

var Layout = React.createClass({
  getInitialState: function(){
    return {
      endpoint: '*',
      highTPS: 0,
      data: null
    };
  },
  endpointsReady: function(value){
    this.updateEndpointData(value);
  },
  updateEndpointData: function(endpoint){
    var highTPS = endpoint?0:this.state.highTPS||0;
    endpoint = endpoint || this.state.endpoint;
    if(this.state.trigger){
      clearTimeout(this.state.trigger);
    }
    Loader.get('/api/v1/window/'+endpoint, function(err, data){
      if(err){
        return alert(err);
      }
      var trigger = setTimeout(this.updateEndpointData, 2000);
      data.buckets.forEach(function(item){
        if(item.size > highTPS){
          highTPS = item.size;
        }
      });
      return this.setState({
        endpoint: endpoint,
        data: data,
        highTPS: highTPS,
        trigger: trigger
      });
    }.bind(this));
  },
  endpointSelected: function(event){
    this.updateEndpointData(Support.val(event.target));
  },
  updateTraffic: function(key, endpoint){
    if(this.state[key+'Trigger']){
      clearTimeout(this.state[key+'Trigger']);
    }
    Loader.get('/api/v1/window/'+endpoint, function(err, data){
      if(err){
        return alert(err);
      }
      var trigger = setTimeout(function(){
        this.updateTraffic(key, endpoint);
      }.bind(this), 2000);
      var stateInfo = {};
      stateInfo[key+'Trigger'] = trigger;
      stateInfo[key] = data;
      return this.setState(stateInfo);
    }.bind(this));
  },
  componentDidMount: function(){
  },
  render: function(){
    return (
      <div>
        <div>
          Endpoint: <EndpointSelector onChange={this.endpointSelected} onLoaded={this.endpointsReady} />
        </div>
        <Vis data={this.state.data} highTPS={this.state.highTPS} />
      </div>
    );
  }
});

module.exports = Layout;

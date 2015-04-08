var React = require('react');
var Loader = require('../lib/loader');
var Support = require('../lib/support');
var rd3 = require('react-d3');
var LineChart = rd3.LineChart;
var AreaChart = rd3.AreaChart;

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
    var items = (this.state.items||[]).map(function(item){
      var text = item.key || item.value || item;
      var value = item.value || item.key || item;
      return <option key={value} value={value}>{text}</option>;
    });
    return (
      <select ref="select" onChange={this.props.onChange}>
        {items}
      </select>
    )
  }
});

var Vis = React.createClass({
  render: function(){
    var data = this.props.data||{buckets: [], stats: {}};
    var highTPS = this.props.highTPS;
    var codes = (data.stats.statusCodes||[]).sort();
    var lineData = codes.map(function(code){
      return {
        name: code,
        values: data.buckets.map(function(bucket){
          return {
            x: new Date(bucket.key+'.000Z'),
            y: parseInt(bucket.stats.statusCodes[code]||0)||0
          }
        })
      };
    });
    var durationData = [
            {
              name: 'Duration',
              values: data.buckets.map(function(bucket){
                return {
                  x: new Date(bucket.key+'.000Z'),
                  y: parseInt(bucket.stats.max)||0
                }
              })
            }
          ];
    var text = JSON.stringify(lineData, null, '  ');
    var fromTime = data.buckets.length?new Date(data.buckets[0].key+'.000Z'):'';
    var toTime = data.buckets.length?new Date(data.buckets[data.buckets.length-1].key+'.000Z'):'';
    var width = document.body.clientWidth-50;
    var countsChart = data.buckets.length?<LineChart
                  legend={true}
                  data={lineData}
                  width={width}
                  height={300}
                  title={"Hit Counts from "+fromTime+" to "+toTime}
                  />:'Loading';
    var durationChart = data.buckets.length?<LineChart
                  legend={false}
                  data={durationData}
                  width={width}
                  height={300}
                  title={"Max Duration from "+fromTime+" to "+toTime}
                  />:'Loading';
    return (
      <div>
        {countsChart}
        {durationChart}
        <div>
          <br />High TPS: {highTPS}
        </div>
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
  render: function(){
    return (
      <div>
        <h1>Window Endpoint Overview</h1>
        <div>
          Endpoint: <EndpointSelector onChange={this.endpointSelected} onLoaded={this.endpointsReady} />
        </div>
        <Vis data={this.state.data} highTPS={this.state.highTPS} />
      </div>
    );
  }
});

module.exports = Layout;

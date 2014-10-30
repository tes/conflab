/**
 * These are some helper api that wrap conflab and etcd
 * that allow you to build a UI - do not require if not necessary
 * The key is to not expose the UI to the bad etcd interface
 */
var _ = require('lodash');
var utils = require('../lib/utils');

function Api(config) {
    this.config = config;
    this.heartbeatInterval = 10000;
}

Api.prototype.getServices = function(next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/';
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        var serviceNodes = _.sortBy(_.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')}));
        next(null, serviceNodes);
    });
}

Api.prototype.updateKey = function(service, environment, key, value, next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var etcdkey = '/conflab/' + service + '/config/' + environment + '/' + key;
    etcd.set(etcdkey, value, function(err) {
        if(err) return next(err);
        next();        
    });
}


Api.prototype.deleteKey = function(service, environment, key, next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var etcdkey = '/conflab/' + service + '/config/' + environment + '/' + key;
    etcd.del(etcdkey, function(err) {
        if(err) return next(err);
        next();        
    });
}

Api.prototype.getServices = function(next) {
    // Get a list of all the services loaded into etcd
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/';
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        var serviceNodes = _.sortBy(_.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')}));
        next(null, serviceNodes);
    });
}

Api.prototype.getServiceEnvironments = function(service, next) {
    // Get a list of all the services loaded into etcd
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/' + service + '/files/';
    var heartbeat = '/conflab/' + service + '/heartbeat/';
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        var environments = _.sortBy(_.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')}), function(env) {
            switch(env) {
                case 'local':
                    return 1;                    
                case 'development':
                    return 2;                    
                case 'test':
                    return 3;                    
                case 'staging':
                    return 4;                    
                case 'live':
                    return 5;                    
                default:
                    return 6
            }
        });
        // Add heartbeats
        etcd.get(heartbeat, function(err, data) {            
            var heartbeats = {};
             _.each(data.node.nodes, function(item) {              
                var status = (Date.now() - item.value) > self.heartbeatInterval ? 'offline' : 'ok';
                var environment = item.key.replace(heartbeat,'');                
                heartbeats[environment] = status;
            });           
            next(null, {service: service, environments: environments, heartbeats: heartbeats});
        });
    });
}

Api.prototype.getServiceEnvironmentFiles = function(service, environment, next) {
    // Get a list of all the services loaded into etcd
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/' + service + '/files/' + environment + '/';
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        var files = _.sortBy(_.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')}));        
        files.push('etcd');
        next(null, {service: service, environment: environment, files: files});
    });
}

Api.prototype.getServiceEnvironmentFileConfig =  function(service, environment, file, next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key;    
    if(file == 'etcd') {
        key = '/conflab/' + service + '/config/' + environment;    
    } else {
        key = '/conflab/' + service + '/files/' + environment + '/' + file;    
    }
    etcd.get(key, function(err, data) {        
        if(err) return next(err);
        var config;
        if(file == 'etcd') {
            config = utils.objFromNode(data.node); 
        } else {
            config = JSON.parse(data.node.value);
        }        
        delete config._
        next(null, {service: service, environment: environment, file: file, config: config});
    });
}


module.exports = Api;


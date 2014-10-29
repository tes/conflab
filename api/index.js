/**
 * These are some helper api that wrap conflab and etcd
 * that allow you to build a UI - do not require if not necessary
 * The key is to not expose the UI to the bad etcd interface
 */
var _ = require('lodash');
var utils = require('../lib/utils');

function Api(config) {
    this.config = config;
}

Api.prototype.getServices = function(next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/';
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        var serviceNodes = _.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')});
        next(null, serviceNodes);
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
        var serviceNodes = _.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')});
        next(null, serviceNodes);
    });
}

Api.prototype.getServiceEnvironments = function(service, next) {
    // Get a list of all the services loaded into etcd
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/' + service + '/files/';
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        var environments = _.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')});
        next(null, {service: service, environments: environments});
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
        var files = _.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,'')});
        next(null, {service: service, environment: environment, files: files});
    });
}

Api.prototype.getServiceEnvironmentFileConfig =  function(service, environment, file, next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/' + service + '/files/' + environment + '/' + file;
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        next(null, {service: service, environment: environment, file: file, config: JSON.parse(data.node.value)});
    });
}

Api.prototype.getServiceEnvironmentMergedConfig = function(service, environment, next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/' + service + '/files/' + environment + '/merged';
    etcd.get(key, function(err, data) {
        if(err) return next(err);
        next(null, {service: service, environment: environment, config: JSON.parse(data.node.value)});
    });
}

Api.prototype.getServiceEnvironmentEtcdConfig = function(service, environment, next) {
    var self = this;
    var etcd = self.config._.etcd;
    if(!etcd) return next(new Error('Etcd not available'));
    var key = '/conflab/' + service + '/config/' + environment;
    etcd.get(key, {recursive: true}, function(err, config) {
        if(err) return next(err);
        var jsonObject = utils.objFromNode(config.node);
        next(null, {service: service, environment: environment, config: jsonObject});
    });
}

module.exports = Api;


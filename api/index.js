/**
 * These are some helper api that wrap conflab and etcd
 * that allow you to build a UI - do not require if not necessary
 * The key is to not expose the UI to the bad etcd interface
 */
var config = require('../');
var _ = require('lodash');
var utils = require('../lib/utils');

module.exports = {
    getServices: function(next) {
        // Get a list of all the services loaded into etcd
        var etcd = config._.etcd;
        if(!etcd) return next(new Error('Etcd not available'));
        var key = '/conflab/';
        etcd.get(key, function(err, data) {
            if(err) return next(err);
            var serviceNodes = _.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,"")});
            next(null, serviceNodes);
        });
    },
    getServiceEnvironments: function(service, next) {
        // Get a list of all the services loaded into etcd
        var etcd = config._.etcd;
        if(!etcd) return next(new Error('Etcd not available'));
        var key = '/conflab/' + service + '/_files/';
        etcd.get(key, function(err, data) {
            if(err) return next(err);
            var environments = _.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,"")});
            next(null, {service: service, environments: environments});
        });
    },
    getServiceEnvironmentFiles: function(service, environment, next) {
        // Get a list of all the services loaded into etcd
        var etcd = config._.etcd;
        if(!etcd) return next(new Error('Etcd not available'));
        var key = '/conflab/' + service + '/_files/' + environment + "/";
        etcd.get(key, function(err, data) {
            if(err) return next(err);
            var files = _.map(_.pluck(data.node.nodes, 'key'), function(item) { return item.replace(key,"")});
            next(null, {service: service, environment: environment, files: files});
        });
    },
    getServiceEnvironmentFileConfig: function(service, environment, file, next) {
        var etcd = config._.etcd;
        if(!etcd) return next(new Error('Etcd not available'));
        var key = '/conflab/' + service + '/_files/' + environment + "/" + file;
        etcd.get(key, function(err, data) {
            if(err) return next(err);
            next(null, {service: service, environment: environment, file: file, config: JSON.parse(data.node.value)});
        });
    },
    getServiceEnvironmentMergedConfig: function(service, environment, next) {
        var etcd = config._.etcd;
        if(!etcd) return next(new Error('Etcd not available'));
        var key = '/conflab/' + service + '/_merged/' + environment;
        etcd.get(key, function(err, data) {
            if(err) return next(err);
            next(null, {service: service, environment: environment, config: JSON.parse(data.node.value)});
        });
    },
    getServiceEnvironmentEtcdConfig: function(service, environment, next) {
        var etcd = config._.etcd;
        if(!etcd) return next(new Error('Etcd not available'));
        var key = '/conflab/' + service + '/_etcd/' + environment;
        etcd.get(key, {recursive: true}, function(err, config) {
            if(err) return next(err);
            var jsonObject = utils.objFromNode(config.node);
            next(null, {service: service, environment: environment, config: jsonObject});
        });
    }
}


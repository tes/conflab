
/**
 * Simple script to demonstrate interaction with api
 */

var path = require('path');
var Conflab = require('..');
var Api = require('../api');
var async = require('async');

process.env.CONFLAB_CONFIG = path.join(__dirname,'..','tests','etcd');

Conflab.load(function(err, config) {

    var capi = new Api(config);
    capi.getServices(function(err, services) {
        console.dir(services);
    });

    capi.getServiceEnvironments('service-page-composer', function(err, environments) {
        console.dir(environments);
    });

    capi.getServiceEnvironmentFiles('service-page-composer', 'local', function(err, files) {
        console.dir(files);
    });

    capi.getServiceEnvironmentFileConfig('service-page-composer', 'local', 'default', function(err, file) {
        console.dir(file);
    });

    capi.getServiceEnvironmentEtcdConfig('service-page-composer', 'local', function(err, config) {
        console.dir(config);
    });
})


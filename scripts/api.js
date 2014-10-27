
var path = require('path');
process.env.CONFLAB_CONFIG = path.join(__dirname,'..','tests','etcd');
var config = require('..');
var capi = require('../Api');
var async = require('async');

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

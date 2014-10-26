'use strict';

var fs = require('fs');
var path = require('path');
var hostname = require('os').hostname().replace(/\..*/, '');
var environment = process.env.NODE_ENV || "development";
var async = require('async');
var _ = require('lodash');

function Config() {

    var self = this;
    self.serviceConfig = process.env.SERVICE_CONFIG || path.join(process.cwd(), 'config');
    self.moduleConfig = process.env.MODULE_CONFIG || path.join(__dirname, 'config');

}

Config.prototype.load = function() {

    var self = this;

    self.config = {};
    self.done = false;

    self.loadConfig(function loadConfigCb() {
      self.done = true;
    });

    while(!self.done) {
      require('deasync').runLoopOnce();
    }

    return self.config;
}

Config.prototype.loadConfig = function(next) {

    var self = this;

    // Order here matters, last one always wins
    var configFiles = [
        path.join(self.moduleConfig, 'default.json'),
        path.join(self.moduleConfig, environment + '.json'),
        path.join(self.serviceConfig, 'default.json'),
        path.join(self.serviceConfig, environment + '.json'),
        path.join(self.serviceConfig, 'runtime.json'),
        path.join(self.serviceConfig, hostname + '.json')
    ];

    async.mapSeries(configFiles, self.loadFile.bind(self), next);

}

Config.prototype.loadFile = function(filename, next) {

    var self = this;
    var defaultsDeep = _.partialRight(_.merge, function deep(value, other) {
      return _.merge(value, other, deep);
    });

    fs.exists(filename, function (exists) {
      if(!exists) { return next(); }
      fs.readFile(filename, function (err, data) {
        if(err) { return next(); }
        var jsonData;
        try {
            jsonData = JSON.parse(data);
        } catch(ex) {
            return next();
        }
        self.config = defaultsDeep(jsonData, self.config);
        return next();
      });
    });

}

var config = new Config();
module.exports = config.load();

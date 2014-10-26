'use strict';

var fs = require('fs');
var path = require('path');
var hostname = require('os').hostname().replace(/\..*/, '');
var async = require('async');
var Etcd = require('node-etcd');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

var defaultsDeep = _.partialRight(_.merge, function deep(value, other) {
  return _.merge(value, other, deep);
});

/**
 * Core class
 *  - no construction options, all passed via config or env variables
 */
function Config() {
}

/**
 * A singleton async > sync hack.  If this makes you uncomfortable
 * you should probably use a different library.
 */
Config.prototype.load = function() {

    var self = this;

    // If we are already loaded do nothing
    if(self.done) return self.config;

    // This is the configuration that comes from the application it is included in
    self.libraryPath = process.env.CONFLAB_LIBRARY_CONFIG || path.join(__dirname, 'config');
    self.configPath = process.env.CONFLAB_CONFIG || path.join(process.cwd(), 'config');
    self.prefix = '/conflab';

    // Otherwise lets load up
    self.environment = process.env.CONFLAB_ENV || process.env.NODE_ENV || "development";
    self.events = new EventEmitter();

    // Local configs
    self.fileContent = {};
    self.fileConfig = {};
    self.etcdConfig = {};
    self.config = {};

    // Welcome to the magic of deasync
    self.done = false;
    self.loadConfig(function loadConfigCb() {
      self.done = true;
    });
    while(!self.done) {
      require('deasync').runLoopOnce();
    }
    return self.config;

}

/**
 * Load configuration from files and then from etcd if appropriate
 */
Config.prototype.loadConfig = function(next) {

    var self = this;
    self.loadFromFiles(function() {
        self.loadFromEtcd(function() {
            self.mergeConfig();
            self.putFilesInEtcd(next);
        });
    });

}

/**
 * Copy file content over to keys in etcd
 * This enables admin tools to display what is in the files
 * that are running.  It is brought up to date whenever the app
 * is started, no need to update in any other circumstance (so no ttl);
 */
Config.prototype.putFilesInEtcd = function(next) {

    var self = this;
    if(!self.etcd) return next();

    var loadFile = function(file, cb) {
        var fileJson = self.fileContent[file];
        var etcdKey = path.join(self.etcdKey, '_files', self.environment, file);
        self.etcd.set(etcdKey, JSON.stringify(fileJson), cb);
    }

    async.map(_.keys(self.fileContent),loadFile, function(err) {
        next();
    })

}

Config.prototype.mergeConfig = function() {

    var self = this;
    self.config = {_:{}};
    self.config = defaultsDeep(self.fileConfig, self.config);
    self.config = defaultsDeep(self.etcdConfig, self.config);
    self.config._.on = self.events.on.bind(self.events);
    self.config._.stop = self.watcher ? self.watcher.stop.bind(self.watcher) : function() {};

}

Config.prototype.loadFromEtcd = function(next) {

    var self = this;

    var processValue = function(value) {
        if(value === 'false') return false;
        if(value === 'true') return true;
        if(isNaN(value)) return value;
        return +value;
    }

    var parseConfig = function(node, cb) {

        var updateConfig = function(action, fullKey, newValue) {
            var obj = {}, keys = fullKey.split("/"), key, isLast, currObj = self.etcdConfig;
            while(keys.length > 0) {
                key = keys.shift(), isLast = keys.length > 0 ? false : true;
                if(isLast) {
                    if(newValue) {
                        currObj[key] = processValue(newValue);
                    } else {
                        delete currObj[key];
                    }
                } else {
                    if(!currObj[key]) currObj[key] = {}
                    currObj = currObj[key];
                }
            }
            self.mergeConfig();
        }

        var jsonData = {};
        var createConfig = function(parentKey, nodes, jsonData) {
            nodes.forEach(function(currentNode) {
                var key = currentNode.key.replace(parentKey + '/','');
                if(currentNode.nodes) {
                    jsonData[key] = {};
                    createConfig(currentNode.key, currentNode.nodes, jsonData[key]);
                } else {
                    jsonData[key] = processValue(currentNode.value);
                }
            });
        }

        if(node.nodes) createConfig(node.key, node.nodes, jsonData);

        self.etcdConfig = defaultsDeep(jsonData, self.etcdConfig);

        // Configure the watcher
        self.watcher = self.etcd.watcher(self.etcdKey + '/', null, {recursive: true});
        self.watcher.on('change', function(config) {
            var key = config.node.key.replace(self.etcdKey + '/','');
            updateConfig(config.action, key, config.node.value);
            self.events.emit('change');
        });

        cb();

    }

    if(!self.fileConfig.etcd) { return next(); }

    // Etcd needs a service name to create the key
    var packageJson = path.join(process.cwd(), 'package.json');
    if(fs.existsSync(packageJson)) {
       self.etcdKey = self.prefix + "/" + require(packageJson).name;
    } else {
        console.log('[CONFLAB] Error: You cant use etcd in a service without a name in the package.json');
        return next();
    }

    self.etcd = new Etcd(self.fileConfig.etcd.host || '127.0.0.1', self.fileConfig.etcd.port || '4001');

    self.etcd.get(self.etcdKey, {recursive: true}, function(err, config) {
        if(err) { return next(); }
        parseConfig(config.node, next);
    });

}

Config.prototype.loadFromFiles = function(next) {

    var self = this;

    // Order here matters, last one always wins
    var configFiles = [
        {path: path.join(self.libraryPath, 'default.json'), name: 'library'},
        {path: path.join(self.configPath, 'default.json'), name: 'default'},
        {path: path.join(self.configPath, self.environment + '.json'), name: 'environment'},
        {path: path.join(self.configPath, 'runtime.json'), name: 'runtime'},
        {path: path.join(self.configPath, hostname + '.json'), name: 'hostname-' + hostname}
    ];

    async.mapSeries(configFiles, self.loadFile.bind(self), next);
}

Config.prototype.loadFile = function(file, next) {

    var self = this;
    fs.exists(file.path, function (exists) {
      if(!exists) { return next(); }
      fs.readFile(file.path, function (err, data) {
        if(err) { return next(); }
        var jsonData;
        try {
            jsonData = JSON.parse(data);
        } catch(ex) {
            return next();
        }
        // Save the content for later and reload
        self.fileContent[file.name] = jsonData;
        self.fileConfig = defaultsDeep(jsonData, self.fileConfig);
        return next();
      });
    });

}

var config = new Config();
module.exports = config.load();

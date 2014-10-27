'use strict';

var fs = require('fs');
var path = require('path');
var hostname = require('os').hostname().replace(/\..*/, '');
var async = require('async');
var Etcd = require('node-etcd');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var utils = require('./lib/utils');
var defaultsDeep = _.partialRight(_.merge, function deep(value, other) {
  return _.merge(value, other, deep);
});

/**
 * Core class - no construction options, all passed via config or env variables
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
        var etcdKey = path.join(self.etcdKeyBase, '_files', self.environment, file);
        self.etcd.set(etcdKey, JSON.stringify(fileJson), cb);
    }

    async.map(_.keys(self.fileContent),loadFile, function(err) {
        next();
    })

}

/**
 * Merge the file and etcd config together with helpers, this is done
 * to allow the etcd config to change without reloading files.
 */
Config.prototype.mergeConfig = function() {

    var self = this;
    self.config = {_:{}};
    self.config = defaultsDeep(self.fileConfig, self.config);
    self.config = defaultsDeep(self.etcdConfig, self.config);
    self.config._.on = self.events.on.bind(self.events);
    self.config._.etcd = self.etcd;
    self.config._.stop = self.watcher ? self.watcher.stop.bind(self.watcher) : function() {};

}

/**
 * Load config from etcd - fails silently if no etcd config defined in files
 */
Config.prototype.loadFromEtcd = function(next) {

    var self = this;

    var parseConfig = function(node, cb) {

        self.etcdConfig = defaultsDeep(utils.objFromNode(node), self.etcdConfig);

        // Configure the watcher
        self.watcher = self.etcd.watcher(self.etcdKey + '/', null, {recursive: true});
        self.watcher.on('change', function(config) {
            var key = config.node.key.replace(self.etcdKey + '/','');
            utils.index(self.etcdConfig, key, config.action, config.node.value)
            self.mergeConfig();
            self.events.emit('change');
        });

        cb();

    }

    if(!self.fileConfig.etcd) { return next(); }

    // Etcd needs a service name to create the key
    var packageJson = path.join(process.cwd(), 'package.json');
    if(fs.existsSync(packageJson)) {
       self.etcdKeyBase = self.prefix + "/" + require(packageJson).name;
       self.etcdKey = self.etcdKeyBase + '/_etcd/' + self.environment;
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

/**
 * Load config from files, order defined here is important.
 */
Config.prototype.loadFromFiles = function(next) {

    var self = this;

    // Order here matters, last one always wins
    var configFiles = [
        {path: path.join(self.libraryPath, 'default.json'), name: 'lib-default'},
        {path: path.join(self.libraryPath, self.environment + '.json'), name: 'lib-environment'},
        {path: path.join(self.configPath, 'default.json'), name: 'default'},
        {path: path.join(self.configPath, self.environment + '.json'), name: 'environment'},
        {path: path.join(self.configPath, 'runtime.json'), name: 'runtime'},
        {path: path.join(self.configPath, hostname + '.json'), name: 'hostname-' + hostname}
    ];


    async.mapSeries(configFiles, self.loadFile.bind(self), next);
}

/**
 * Load a specific file into the fileConfig
 */
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

/**
 * Export an already loaded singleton
 */
var config = new Config();
module.exports = config.load();

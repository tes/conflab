'use strict';

var fs = require('fs');
var path = require('path');
var hostname = require('os').hostname().replace(/\..*/, '');
var async = require('async');
var Etcd = require('node-etcd');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var utils = require('./lib/utils');
var minimist = require('minimist');
var pathval = require('pathval');
var stripBom = require('strip-bom');
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
Config.prototype.load = function(options, next) {

    if(!next) {
        next = options;
        options = {};
    } else {
        options = options || {};
    }

    var self = this;
    if(self.loaded) return next(null, self.config);

    self.options = options;
    self.loaded = false;
    self.heartbeatInterval = 10000;

    // This is the configuration that comes from the application it is included in
    self.libraryPath = options.libraryPath || process.env.CONFLAB_LIBRARY_CONFIG || path.join(__dirname, 'config');
    self.configPath = options.configPath || process.env.CONFLAB_CONFIG || path.join(process.cwd(), 'config');
    self.prefix = '/conflab';

    // Otherwise lets load up
    self.environment = options.env || process.env.CONFLAB_ENV || process.env.NODE_ENV || 'development';
    self.events = new EventEmitter();

    // Local configs
    self.fileContent = {};
    self.fileConfig = {};
    self.etcdConfig = {};
    self.config = {};
    self.ignoreExport = {};

    self.loadConfig(function loadConfigCb(err) {
        if (err) {
            return next(err);
        }
        self.loaded = true;
        self.heartbeat();
        next(null, self.config);
    });

}

/**
 * Load configuration from files and then from etcd if appropriate
 */
Config.prototype.loadConfig = function(next) {

    var self = this;
    async.series([
        self.loadFromOptions.bind(self),
        self.loadFromFiles.bind(self),
        self.loadFromArgv.bind(self),
        self.loadFromEtcd.bind(self),
        self.mergeConfig.bind(self)
    ], next);
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
        if (self.ignoreExport[file]) return cb();
        var fileJson = self.fileContent[file];
        var etcdKey = path.join(self.etcdKeyBase, 'files', self.environment, file);
        self.etcd.set(etcdKey, JSON.stringify(fileJson), cb);
    }

    var loadConfig = function(cb) {
        var etcdKey = path.join(self.etcdKeyBase, 'files', self.environment, 'merged');
        self.etcd.set(etcdKey, JSON.stringify(self.config), cb);
    }

    async.each(_.keys(self.fileContent),loadFile, function() {
        loadConfig(next);
    });

}

/**
 * Merge the file and etcd config together with helpers, this is done
 * to allow the etcd config to change without reloading files.
 */
Config.prototype.mergeConfig = function(next) {

    var self = this;
    self.config = {_:{}};
    self.config = defaultsDeep(self.fileConfig, self.config);
    self.config = defaultsDeep(self.etcdConfig, self.config);
    self.config._.on = self.events.on.bind(self.events);
    self.config._.etcd = self.etcd;
    self.config._.stop = self.watcher ? self.watcher.stop.bind(self.watcher) : function() {};
    self.putFilesInEtcd(next);

}

/**
 * Update a key on etcd every 10 seconds so that it nows the service is up.
 */
Config.prototype.heartbeat = function() {
    var self = this;
    if(!self.etcd) return;
    var hbKey = self.etcdKeyBase + '/heartbeat/' + self.environment;
    self.etcd.set(hbKey, Date.now());
    setTimeout(self.heartbeat.bind(self), self.heartbeatInterval);
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
            pathval.set(self.etcdConfig, key, config.node.value);
            self.mergeConfig();
            self.events.emit('change');
        });

        cb();

    }

    if(!self.fileConfig.etcd) { return next(); }

    // Etcd needs a service name to create the key
    var packageJson = path.join(process.cwd(), 'package.json');
    if(fs.existsSync(packageJson)) {
       self.etcdKeyBase = self.prefix + '/' + require(packageJson).name;
       self.etcdKey = self.etcdKeyBase + '/config/' + self.environment;
    } else {
        console.log('[CONFLAB] Error: You cant use etcd in a service without a name in the package.json');
        return next();
    }

    self.etcd = new Etcd(self.fileConfig.etcd.hosts);

    self.etcd.set(self.etcdKey + '/__', 'Ensure config can be watched', function(err) {
        if (err) return next(err);
        self.etcd.get(self.etcdKey, {recursive: true}, function(err, config) {
            if (err) return next(err);
            parseConfig(config.node, next);
        });
    });
}

Config.prototype.loadFromOptions = function(next) {
    var self = this;
    if (_.isEmpty(self.options.config)) return next();
    var data = _.cloneDeep(self.options.config);
    self.fileContent.opts = data;
    self.fileConfig = defaultsDeep(_.cloneDeep(data), self.fileConfig);
    next();
}

Config.prototype.loadFromArgv = function(next) {
    var self = this;
    var config = minimist(process.argv.slice(2));
    delete config._ // Remove as not needed
    var jsonData = {};
    _.forOwn(config, function(value, key) {
        pathval.set(jsonData, key.replace(/\//g,'.'), value);
    });
    self.fileContent.argv = _.cloneDeep(jsonData);
    self.fileConfig = defaultsDeep(jsonData, self.fileConfig);
    next();
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

            jsonData = JSON.parse(stripBom(data));
        } catch(ex) {
            return next((ex.sourceFile = file.path) && ex);
        }
        // Save the content for later and reload, clone to ensure the defaults
        // Doesn't over-ride
        self.fileContent[file.name] = _.cloneDeep(jsonData);
        self.fileConfig = defaultsDeep(jsonData, self.fileConfig);
        markForExport(file);
        return loadAdditionalFiles(file, next);
      });
    });

    function loadAdditionalFiles(file, next) {
        var files = self.fileContent[file.name].CF_additionalFiles;
        if (_.isEmpty(files)) return next();
        async.each(files, loadOne, next);

        function loadOne(location, next) {
            if (path.resolve(location) !== path.normalize(location)) {
                location = path.resolve(path.dirname(file.path), location);
            }
            self.loadFile({
                path: location,
                name: file.name + '-' + path.basename(location, path.extname(location)),
                additional: true
            }, next);
        }
    }

    function markForExport(file) {
        var exportToEtcd = self.fileContent[file.name].CF_exportToEtcd;
        var explicit = exportToEtcd !== null && exportToEtcd !== undefined;
        self.ignoreExport[file.name] = (explicit && !exportToEtcd) || (file.additional && !explicit);
    }

}

/**
 * Export an already loaded singleton
 */
module.exports = Config;

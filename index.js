'use strict';

var fs = require('fs');
var path = require('path');
var hostname = require('os').hostname().replace(/\..*/, '');
var async = require('async');
var _ = require('lodash');
var minimist = require('minimist');
var pathval = require('pathval');
var stripBom = require('strip-bom');
var mergeDeep = require('./merge-deep');

/**
 * Core class - no construction options, all passed via config or env variables
 */
function Config() {
}

/**
 * A singleton async > sync hack.  If this makes you uncomfortable
 * you should probably use a different library.
 */
Config.prototype.load = function(options, overrides, next) {

    if(!next) {
        if (!overrides){
            next = options;
            options = {};
            overrides = {};
        } else {
            next = overrides;
            options = options || {};
        }
    } else {
        options = options || {};
    }

    var self = this;
    if(self.loaded) return next(null, self.config);

    self.options = options;
    self.loaded = false;
    self.overrides = overrides;

    var configDir;
    var pm2Exec = process.env.pm_exec_path;
    if (pm2Exec) {
      // If exec path is a file, get the directory of that file
      configDir = Boolean(path.extname(pm2Exec)) ? path.dirname(pm2Exec) : pm2Exec;
    } else {
      configDir = process.cwd();
    }

    // This is the configuration that comes from the application it is included in
    self.libraryPath = options.libraryPath || process.env.CONFLAB_LIBRARY_CONFIG || path.join(__dirname, 'config');
    self.configPath = options.configPath || process.env.CONFLAB_CONFIG || path.join(configDir, 'config');

    // Otherwise lets load up
    self.environment = options.env || process.env.CONFLAB_ENV || process.env.NODE_ENV || 'development';

    // Local configs
    self.fileContent = {};
    self.fileConfig = {};
    self.config = {};
    self.ignoreExport = {};

    self.loadConfig(function loadConfigCb(err) {
        if (err) {
            return next(err);
        }
        self.loaded = true;
        next(null, self.config);
    });

}

/**
 * Load configuration from options, files and argv
 */
Config.prototype.loadConfig = function(next) {

    var self = this;
    async.series([
        self.loadFromOptions.bind(self),
        self.loadFromFiles.bind(self),
        self.loadFromArgv.bind(self),
        self.loadFromOverrides.bind(self),
        self.mergeConfig.bind(self)
    ], next);
}

/**
 * Merge the file and etcd config together with helpers, this is done
 * to allow the etcd config to change without reloading files.
 */
Config.prototype.mergeConfig = function(next) {

    var self = this;
    self.config = {_:{}};
    self.config = mergeDeep(self.config, self.fileConfig);
    next();

}

Config.prototype.loadFromOptions = function(next) {
    var self = this;
    if (_.isEmpty(self.options.config)) return next();
    var data = _.cloneDeep(self.options.config);
    self.fileContent.opts = data;
    self.fileConfig = mergeDeep(self.fileConfig, _.cloneDeep(data));
    next();
}

Config.prototype.loadFromOverrides = function(next) {
    var self = this;
    if (_.isEmpty(self.overrides.config)) return next();
    var data = _.cloneDeep(self.overrides.config);
    self.fileContent.opts = data;
    self.fileConfig = mergeDeep(self.fileConfig, _.cloneDeep(data));
    next();
};

Config.prototype.loadFromArgv = function(next) {
    var self = this;
    var config = minimist(process.argv.slice(2));
    delete config._ // Remove as not needed
    var jsonData = {};
    _.forOwn(config, function(value, key) {
        pathval.set(jsonData, key.replace(/\//g,'.'), value);
    });
    self.fileContent.argv = _.cloneDeep(jsonData);
    self.fileConfig = mergeDeep(self.fileConfig, jsonData);
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
            self.fileConfig = mergeDeep(self.fileConfig, jsonData);
            return loadAdditionalFiles(file, next);
        });
    });

    function loadAdditionalFiles(file, next) {
        var files = self.fileContent[file.name].CF_additionalFiles;

        if (!files) return next();

        if (!_.isArray(files)) {
            files = [files];
        }

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

}

/**
 * Export an already loaded singleton
 */
module.exports = Config;

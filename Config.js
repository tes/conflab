'use strict';

var fs = require('fs');
var path = require('path');
var hostname = require('os').hostname().replace(/\..*/, '');
var async = require('async');
var _ = require('lodash');
var minimist = require('minimist');
var pathval = require('pathval');
var stripBom = require('strip-bom');

var utils = require('./lib/utils');

/**
 * Core class - no construction options, all passed via config or env variables
 */
function Config() {
  // Local configs
  this.fileContent = {};
  this.fileConfig = {};
  this.config = {};
  this.ignoreExport = {};
}

/**
 * A singleton async > sync hack.  If this makes you uncomfortable
 * you should probably use a different library.
 */
Config.prototype.load = function(options, next) {
  if (!next) {
    next = options;
    options = {};
  } else {
    options = options || {};
  }

  if (this.loaded) { return next(null, this.config); }

  this.options = options;
  this.loaded = false;

  // This is the configuration that comes from the application it is included in
  this.libraryPath = options.libraryPath || process.env.CONFLAB_LIBRARY_CONFIG || path.join(__dirname, 'config');
  this.configPath = options.configPath || process.env.CONFLAB_CONFIG || path.join(utils.getRootDir(), 'config');

  // Otherwise lets load up
  this.environment = options.env || process.env.CONFLAB_ENV || process.env.NODE_ENV || 'development';

  this.loadConfig(function loadConfigCb(err) {
    if (err) { return next(err); }
    this.loaded = true;
    next(null, this.config);
  }.bind(this));
}

/**
 * Load configuration from files
 */
Config.prototype.loadConfig = function(next) {
  async.series([
    this.loadFromOptions.bind(this),
    this.loadFromFiles.bind(this),
    this.loadFromArgv.bind(this),
    function(cb) { this.config = utils.defaultsDeep(this.fileConfig, this.config); cb(); }.bind(this)
  ], next);
}

Config.prototype.loadFromOptions = function(next) {
  if (_.isEmpty(this.options.config)) { return next(); }

  var data = _.cloneDeep(this.options.config);
  this.fileContent.opts = data;
  this.fileConfig = utils.defaultsDeep(_.cloneDeep(data), this.fileConfig);
  next();
}

Config.prototype.loadFromArgv = function(next) {
  var jsonData = {};
  var config = minimist(process.argv.slice(2));
  delete config._ // Remove as not needed

  _.forOwn(config, function(value, key) { pathval.set(jsonData, key.replace(/\//g, '.'), value); });

  this.fileContent.argv = _.cloneDeep(jsonData);
  this.fileConfig = utils.defaultsDeep(jsonData, this.fileConfig);
  next();
}

/**
 * Load config from files, order defined here is important.
 */
Config.prototype.loadFromFiles = function(next) {
  // Order here matters, last one always wins
  var configFiles = [
    { path: path.join(this.libraryPath, 'default.json'), name: 'lib-default' },
    { path: path.join(this.libraryPath, this.environment + '.json'), name: 'lib-environment' },
    { path: path.join(this.configPath, 'default.json'), name: 'default' },
    { path: path.join(this.configPath, this.environment + '.json'), name: 'environment' },
    { path: path.join(this.configPath, 'runtime.json'), name: 'runtime' },
    { path: path.join(this.configPath, hostname + '.json'), name: 'hostname-' + hostname }
  ];

  async.mapSeries(configFiles, this.loadFile.bind(this), next);
}

/**
 * Load a specific file into the fileConfig
 */
Config.prototype.loadFile = function(file, next) {
  fs.readFile(file.path, function(err, data) {
    if (err) { return next(); }

    var jsonData;
    try {
      jsonData = JSON.parse(stripBom(data));
    } catch (ex) {
      return next((ex.sourceFile = file.path) && ex);
    }

    // Save the content for later and reload, clone to ensure the defaults doesn't over-ride
    this.fileContent[file.name] = _.cloneDeep(jsonData);
    this.fileConfig = utils.defaultsDeep(jsonData, this.fileConfig);

    // TODO: Rename CF_exportToEtcd - should be generic export.
    var exportFile = this.fileContent[file.name].CF_exportToEtcd;
    var explicit = exportFile !== null && exportFile !== undefined;
    this.ignoreExport[file.name] = (explicit && !exportFile) || (file.additional && !explicit);

    var files = this.fileContent[file.name].CF_additionalFiles;
    if (_.isEmpty(files)) { return next(); }

    async.each(files, function loadOne(location, cb) {
      this.loadFile({
        path: path.resolve(location) !== path.normalize(location) ? path.resolve(path.dirname(file.path), location) : location,
        name: file.name + '-' + path.basename(location, path.extname(location)),
        additional: true
      }, cb);
    }.bind(this), next);
  }.bind(this));
}

/**
 * Export an already loaded singleton
 */
module.exports = Config;

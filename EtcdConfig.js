var Etcd = require('node-etcd');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var pathval = require('pathval');
var EventEmitter = require('events').EventEmitter;

var Config = require('./Config');
var utils = require('./lib/utils');

// Etcd needs a service name to create the key
var packageJson = require(path.join(utils.getRootDir(), 'package.json'));

/**
 * Copy file content over to keys in etcd
 * This enables admin tools to display what is in the files
 * that are running.  It is brought up to date whenever the app
 * is started, no need to update in any other circumstance (so no ttl);
 */
function EtcdConfig() {
  Config.call(this);
  this.etcdKeyBase = path.join('/conflab', packageJson.name);
  this.heartbeatInterval = 10000;
  this.events = new EventEmitter();
}

EtcdConfig.prototype = Object.create(Config.prototype);
EtcdConfig.prototype.constructor = EtcdConfig;

EtcdConfig.prototype.loadConfig = function(next) {
  async.series([
    this.loadFromOptions.bind(this),
    this.loadFromFiles.bind(this),
    this.loadFromArgv.bind(this),
    this.loadFromEtcd.bind(this),
    this.mergeConfig.bind(this)
  ], next);
}

/**
 * Merge the file and etcd config together with helpers, this is done
 * to allow the etcd config to change without reloading files.
 */
EtcdConfig.prototype.mergeConfig = function(next) {
  this.config = { _: {} };
  this.config = utils.defaultsDeep(this.fileConfig, this.config);
  this.config = utils.defaultsDeep(this.etcdConfig, this.config);
  this.config._.on = this.events.on.bind(this.events);
  this.config._.etcd = this.etcd;
  this.config._.stop = this.watcher ? this.watcher.stop.bind(this.watcher) : function() {};
  this.putFilesInEtcd(next);
}

EtcdConfig.prototype.putFilesInEtcd = function(next) {
  var loadFile = function(file, cb) {
    if (this.ignoreExport[file]) { return cb(); }
    var etcdKey = path.join(this.etcdKeyBase, 'files', this.environment, file);
    this.etcd.set(etcdKey, JSON.stringify(this.fileContent[file]), cb);
  }.bind(this)

  async.each(_.keys(this.fileContent), loadFile, function() {
    var etcdKey = path.join(this.etcdKeyBase, 'files', this.environment, 'merged');
    this.etcd.set(etcdKey, JSON.stringify(this.config), next);
  }.bind(this));
}

/**
 * Update a key on etcd every 10 seconds so that it knows the service is up.
 */
EtcdConfig.prototype.heartbeat = function() {
  var hbKey = path.join(this.etcdKeyBase, 'heartbeat', this.environment);
  this.etcd.set(hbKey, Date.now());
  setTimeout(this.heartbeat.bind(this), this.heartbeatInterval);
}

/**
 * Load config from etcd
 */
EtcdConfig.prototype.loadFromEtcd = function(next) {
  var self = this;

  if (!self.fileConfig.etcd) { return next(new Error('[CONFLAB] Error: Etcd Config not found.')); }

  self.etcdKey = path.join(self.etcdKeyBase, 'config', self.environment);
  self.etcd = new Etcd(self.fileConfig.etcd.hosts);
  self.heartbeat();

  self.etcd.set(path.join(self.etcdKey, '__'), 'Ensure config can be watched', function(err) {
    if (err) { return next(err); }

    self.etcd.get(self.etcdKey, { recursive: true }, function(err, config) {
      if (err) { return next(err); }

      self.etcdConfig = utils.defaultsDeep(utils.objFromNode(config.node), self.etcdConfig);

      // Configure the watcher
      self.watcher = self.etcd.watcher(self.etcdKey, null, { recursive: true });
      self.watcher.on('change', function(change) {
        var key = change.node.key.replace(self.etcdKey + '/', '');
        pathval.set(self.etcdConfig, key, change.node.value);
        self.mergeConfig();
        self.events.emit('change');
      });

      next();
    });
  });
}

module.exports = EtcdConfig;

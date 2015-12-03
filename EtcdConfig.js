var Etcd = require('node-etcd');
var async = require('async');
var _ = require('lodash');
var path = require('path');
var pathval = require('pathval');
var fs = require('fs');
var EventEmitter = require('events').EventEmitter;

var Config = require('./Config');
var utils = require('./lib/utils');

/**
 * Copy file content over to keys in etcd
 * This enables admin tools to display what is in the files
 * that are running.  It is brought up to date whenever the app
 * is started, no need to update in any other circumstance (so no ttl);
 */
function EtcdConfig() {
  Config.call(this);
  this.prefix = '/conflab';
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
  var self = this;
  if (!self.etcd) { return next(); }

  var loadFile = function(file, cb) {
    if (self.ignoreExport[file]) { return cb(); }
    var fileJson = self.fileContent[file];
    var etcdKey = path.join(self.etcdKeyBase, 'files', self.environment, file);
    self.etcd.set(etcdKey, JSON.stringify(fileJson), cb);
  }

  var loadConfig = function(cb) {
    var etcdKey = path.join(self.etcdKeyBase, 'files', self.environment, 'merged');
    self.etcd.set(etcdKey, JSON.stringify(self.config), cb);
  }

  async.each(_.keys(self.fileContent), loadFile, function() {
    loadConfig(next);
  });
}

/**
 * Update a key on etcd every 10 seconds so that it nows the service is up.
 */
EtcdConfig.prototype.heartbeat = function() {
  var hbKey = this.etcdKeyBase + '/heartbeat/' + this.environment;
  this.etcd.set(hbKey, Date.now());
  setTimeout(this.heartbeat.bind(this), this.heartbeatInterval);
}

/**
 * Load config from etcd - fails silently if no etcd config defined in files
 */
EtcdConfig.prototype.loadFromEtcd = function(next) {
  var self = this;

  var parseConfig = function(node, cb) {
    self.etcdConfig = utils.defaultsDeep(utils.objFromNode(node), self.etcdConfig);

    // Configure the watcher
    self.watcher = self.etcd.watcher(self.etcdKey + '/', null, {recursive: true});
    self.watcher.on('change', function(config) {
      var key = config.node.key.replace(self.etcdKey + '/', '');
      pathval.set(self.etcdConfig, key, config.node.value);
      self.mergeConfig();
      self.events.emit('change');
    });

    cb();

  }

  if (!self.etcd) {
    if (!self.fileConfig.etcd) { return next(); }

    // Etcd needs a service name to create the key
    var packageJson = path.join(process.cwd(), 'package.json');
    if (fs.existsSync(packageJson)) {
      self.etcdKeyBase = self.prefix + '/' + require(packageJson).name;
      self.etcdKey = self.etcdKeyBase + '/config/' + self.environment;
    } else {
      console.log('[CONFLAB] Error: You cant use etcd in a service without a name in the package.json');
      return next();
    }

    self.etcd = new Etcd(self.fileConfig.etcd.hosts);
    self.heartbeat();
  }

  self.etcd.set(self.etcdKey + '/__', 'Ensure config can be watched', function(err) {
    if (err) { return next(err); }

    self.etcd.get(self.etcdKey, {recursive: true}, function(err, config) {
      if (err) { return next(err); }
      parseConfig(config.node, next);
    });
  });
}

module.exports = EtcdConfig;

// Creeate an object from an etcd node heirarchy
// Nodes are stored in a single level with.
var pathval = require('pathval');
var _ = require('lodash');
var path = require('path');

function objFromNode(node) {
  var jsonData = {};
  var createConfig = function(parentKey, nodes, jsonData) {
    nodes.forEach(function(currentNode) {
      var key = currentNode.key.replace(parentKey + '/', '');
      pathval.set(jsonData, key, processValue(currentNode.value));
    });
  }
  if (node.nodes) { createConfig(node.key, node.nodes, jsonData); }
  return jsonData;

}

function processValue(value) {
  if (value === 'false') return false;
  if (value === 'true') return true;
  if (isNaN(value)) return value;
  return +value;
}

var defaultsDeep = _.partialRight(_.merge, function deep(value, other) { return _.merge(value, other, deep); });

function getRootDir() {
  var pm2Exec = process.env.pm_exec_path;
  if (pm2Exec) {
    // If exec path is a file, get the directory of that file
    return Boolean(path.extname(pm2Exec)) ? path.dirname(pm2Exec) : pm2Exec;
  }
  return process.cwd();
}

module.exports = {
  processValue: processValue,
  objFromNode: objFromNode,
  defaultsDeep: defaultsDeep,
  getRootDir: getRootDir
}

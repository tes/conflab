var _ = require('lodash');

// Recursively update or delete a node based on a path, action and value
function index(obj, path, action, value) {
    if (typeof path == 'string')
        return index(obj, path.split('/'), action, value);
    else if (path.length==1 && action == 'set' && value!==undefined)
        return obj[path[0]] = value;
    else if (path.length==1 && action == 'delete')
        return delete obj[path[0]];
    else if (path.length==0)
        return obj;
    else
        return index(obj[path[0]], path.slice(1), action, value);
}

// Creeate an object from an etcd node heirarchy
function objFromNode(node) {

    var jsonData = {};

    var processValue = function(value) {
        if(value === 'false') return false;
        if(value === 'true') return true;
        if(isNaN(value)) return value;
        return +value;
    }

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

    return jsonData;

}

module.exports = {
    index: index,
    objFromNode: objFromNode
}

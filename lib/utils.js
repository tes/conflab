var _ = require('lodash');

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
    objFromNode: objFromNode
}

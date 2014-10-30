// Creeate an object from an etcd node heirarchy
// Nodes are stored in a single level with 
var pathval = require('pathval');

function objFromNode(node) {

    var jsonData = {};
    var createConfig = function(parentKey, nodes, jsonData) {
        nodes.forEach(function(currentNode) {            
            var key = currentNode.key.replace(parentKey + '/','');                    
            pathval.set(jsonData, key, processValue(currentNode.value));            
        });
    }
    if(node.nodes) createConfig(node.key, node.nodes, jsonData);
    return jsonData;

}

function processValue(value) {
    if(value === 'false') return false;
    if(value === 'true') return true;
    if(isNaN(value)) return value;
    return +value;
}


module.exports = {
    processValue: processValue,
    objFromNode: objFromNode
}

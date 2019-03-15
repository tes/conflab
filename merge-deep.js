var _ = require('lodash');

module.exports = function mergeDeep (a, b) {
    return _.mergeWith({}, a, b, function (objectValue, sourceValue) {
        if (_.isNil(objectValue)) {
            return;
        }
        if (!_.isPlainObject(objectValue) || !_.isPlainObject(sourceValue)) {
            return sourceValue;
        }
    });
};

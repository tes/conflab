'use strict';

var expect = require('expect.js');
var _ = require('lodash');
var mergeDeep = require('../merge-deep');

describe('Deep merging', function () {

    it('merges empty objects', function () {
        expect(mergeDeep({}, {})).to.eql({});
    });

    it('merges flat objects', function () {
        expect(mergeDeep({ a: 1, b: 20 }, { b: 2, c: 3 })).to.eql({ a: 1, b: 2, c: 3 });
    });

    it('merges deeply', function () {
        expect(mergeDeep({ a: { b: 1, c: 2 }, d: 2 }, { a: { b: 10 } })).to.eql({ a: { b: 10, c: 2 }, d: 2 })
    });

    it('merges several levels deep', function () {
        expect(mergeDeep(
            { a: { aa: { aaa: 1, bbb: 2 }, bb: 3 }, b: 4 },
            { a: { aa: { aaa: 10 } } }
        )).to.eql({ a: { aa: { aaa: 10, bbb: 2 }, bb: 3 }, b: 4 })
    });

    it('replaces object with scalar', function () {
        expect(mergeDeep({ a: { b: 1 } }, { a: 10 })).to.eql({ a: 10 });
    });

    it('replaces scalar with object', function () {
        expect(mergeDeep({ a: 10 }, { a: { b: 1 } })).to.eql({ a: { b: 1 } });
    });

    it('replaces object with array', function () {
        expect(mergeDeep({ a: { b: 1 } }, { a: [10, 20] })).to.eql({ a: [10, 20] });
    });

    it('replaces array with object', function () {
        expect(mergeDeep({ a: [10, 20] }, { a: { b: 1 } })).to.eql({ a: { b: 1 } });
    });

    it('does not mutate parameters', function() {
        var left = { a: { b: 1, c: 2 } };
        var right = { a: { b: 20, d: 30 } };
        var leftBefore = _.cloneDeep(left);
        var rightBefore = _.cloneDeep(right);

        mergeDeep(left, right);

        expect(left).to.eql(leftBefore);
        expect(right).to.eql(rightBefore);
    });
});
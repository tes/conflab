'use strict';

var expect = require('expect.js');
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var path = require('path');


process.env.CONFIG = path.join(__dirname,'file');

describe('Config file module', function() {

    var config;

    before(function() {
        config = require('..');
    })

    it('should parse independent elements correctly', function() {
        expect(config.serviceKey1).to.be('default');
        expect(config.serviceKey2).to.be('environment');
        expect(config.serviceKey3).to.be('runtime');
    });

    it('should over-ride based on order', function() {
        expect(config.sharedDefaultKey).to.be('service');
        expect(config.serviceKey).to.be('runtime');
        expect(config.serviceKeyEnv).to.be('environment');
    });

    it('should deal with deep objects as expected', function() {
        expect(config.k1.k2.k3).to.be('Hola');
        expect(config.k1.a2).to.be('Adios');
    });

});

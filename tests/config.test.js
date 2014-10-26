'use strict';

var expect = require('expect.js');
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var path = require('path');

process.env.SERVICE_CONFIG = path.join(__dirname,'service');
process.env.MODULE_CONFIG = path.join(__dirname,'module');

describe('Config module', function() {

    it('should parse independent elements correctly', function() {
        var config = require('..');
        expect(config.moduleKey1).to.be('default');
        expect(config.moduleKey2).to.be('environment');
        expect(config.serviceKey1).to.be('default');
        expect(config.serviceKey2).to.be('environment');
        expect(config.serviceKey3).to.be('runtime');
    });

    it('should over-ride based on order', function() {
        var config = require('..');
        expect(config.sharedDefaultKey).to.be('service');
        expect(config.serviceKey).to.be('runtime');
        expect(config.serviceKeyEnv).to.be('environment');
    });

    it('should deal with deep objects as expected', function() {
        var config = require('..');
        expect(config.k1.k2.k3).to.be('Hola');
        expect(config.k1.a2).to.be('Adios');
    });

});

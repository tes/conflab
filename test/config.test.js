'use strict';

var expect = require('expect.js');
var path = require('path');

describe('Config file module', function() {

    var config, Conflab = require('..'), conflab = new Conflab();
    var options = {
        config: {
            serviceKey: 'options',
            serviceKey4: 'options'
        }
    };

    before(function(done) {
        process.env.CONFLAB_CONFIG = path.join(__dirname, 'file');
        conflab.load(options, function(err, conflabConfig) {
            config = conflabConfig;
            done();
        })
    })

    it('should parse independent elements correctly', function() {
        expect(config.serviceKey1).to.be('default');
        expect(config.serviceKey1_1).to.be('additional');
        expect(config.serviceKey2).to.be('environment');
        expect(config.serviceKey3).to.be('runtime');
        expect(config.serviceKey4).to.be('options');
    });

    it('should over-ride based on order', function() {
        expect(config.sharedDefaultKey).to.be('service');
        expect(config.serviceKey).to.be('runtime');
        expect(config.serviceKeyEnv).to.be('environment');
    });

    it('should over-ride based on overrides', function(done) {
        var options = {
            overrides: {
                serviceKey: 'overrides',
            }
        };
        var conflabOverride = new Conflab();
        conflabOverride.load(options, function(err, conflabConfig) {
            expect(conflabConfig.sharedDefaultKey).to.be('service');
            expect(conflabConfig.serviceKey).to.be('overrides');
            done();
        });
    });

    it('should deal with deep objects as expected', function() {
        expect(config.k1.k2.k3).to.be('Hola');
        expect(config.k1.a2).to.be('Adios');
    });

    it('should replace arrays rather than merge them', function() {
      expect(config.arrayKey).to.eql([{ a: 'b' }]);
    });

    it('should provide error with a malformed json', function(done) {
        var old_config = process.env.CONFLAB_CONFIG;
        process.env.CONFLAB_CONFIG = path.join(__dirname, 'badfile');
        var Conflab = require('..'), conflab = new Conflab();
        conflab.load(options, function(err) {
            expect(err).to.be.ok()
            expect(err.sourceFile).to.be.ok()
            process.env.CONFLAB_CONFIG = old_config;
            done()
        })
    });

});

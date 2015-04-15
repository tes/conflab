'use strict';

var expect = require('expect.js');
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
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
        process.env.CONFLAB_CONFIG = path.join(__dirname,'file');
        conflab.load(options, function(err, conflabConfig) {
            config = conflabConfig;
            done();
        })
    })

    it('should parse independent elements correctly', function() {
        expect(config.serviceKey1).to.be('default');
        expect(config.serviceKey1_1).to.be('external');
        expect(config.serviceKey2).to.be('environment');
        expect(config.serviceKey3).to.be('runtime');
        expect(config.serviceKey4).to.be('options');
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

describe('Config etcd module', function() {

    var Etcd = require('node-etcd');
    var fileConfig = require(path.join(__dirname,'etcd','default.json'));
    var etcd = new Etcd(fileConfig.etcd.host || '127.0.0.1', fileConfig.etcd.port || '4001');
    var config, Conflab = require('..'), conflab = new Conflab();

    before(function(done) {
        etcd.rmdir("/conflab/conflab/config/test", { recursive: true }, function(err) {
            etcd.set("/conflab/conflab/config/test/ekey1", "value", function() {
                // Can't load config in here as it seems to screw with mocha
                process.env.CONFLAB_CONFIG = path.join(__dirname,'etcd');
                config = conflab.load(function(err, conflabConfig) {
                    config = conflabConfig;
                    done();
                })
            });
        });
    });

    it('should load configuration', function() {
        expect(config.ekey1).to.be('value');
        expect(config.k1.k2.k3).to.be('Hola');
    });

    it('should update if etcd configuration changed', function(done) {
        etcd.set("/conflab/conflab/config/test/ekey1", "value2", function() {
            expect(config.ekey1).to.be('value2');
            expect(config.k1.k2.k3).to.be('Hola');
            done();
        });
    });

    it('should over-write if etcd added for node in file', function(done) {
        etcd.set("/conflab/conflab/config/test/k1.k2.k3", "Gracias", function() {
            expect(config.k1.k2.k3).to.be('Gracias');
            done();
        });
    });

    it('should reset back to file default if etcd removed for node in file', function(done) {
        etcd.rmdir("/conflab/conflab/config/test/k1.k2.k3", {recursive: true}, function() {
            expect(config.k1.k2.k3).to.be('Hola');
            done();
        });
    });

});

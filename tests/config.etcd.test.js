'use strict';

var expect = require('expect.js');
var async = require('async');
var fs = require('fs');
var _ = require('lodash');
var path = require('path');
var Etcd = require('node-etcd');
var fileConfig = require(path.join(__dirname,'etcd','default.json'));
var etcd = new Etcd(fileConfig.etcd.host || '127.0.0.1', fileConfig.etcd.port || '4001');

process.env.CONFLAB_CONFIG = path.join(__dirname,'etcd');

describe('Config etcd module', function() {

    var config;

    before(function(done) {
        etcd.rmdir("/conflab", { recursive: true }, function(err) {
            etcd.mkdir("/conflab/conflab", function(err) {
                etcd.set("/conflab/conflab/ekey1", "value", function() {
                    // Can't load config in here as it seems to screw with mocha
                    done();
                });
            });
        });
    });

    it('should load configuration', function() {
        config = require('..');
        expect(config.ekey1).to.be('value');
        expect(config.k1.k2.k3).to.be('Hola');
    });

    it('should update if etcd configuration changed', function(done) {
        config = require('..');
        etcd.set("/conflab/conflab/ekey1", "value2", function() {
            expect(config.ekey1).to.be('value2');
            expect(config.k1.k2.k3).to.be('Hola');
            done();
        });
    });

    it('should over-write if etcd added for node in file', function(done) {
        config = require('..');
        etcd.set("/conflab/conflab/k1/k2/k3", "Gracias", function() {
            expect(config.k1.k2.k3).to.be('Gracias');
            done();
        });
    });

    it('should reset back to file default if etcd removed for node in file', function(done) {
        config = require('..');
        etcd.rmdir("/conflab/conflab/k1", {recursive: true}, function() {
            expect(config.k1.k2.k3).to.be('Hola');
            done();
        });
    });

});

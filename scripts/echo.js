var path = require('path');
process.env.CONFLAB_CONFIG = path.join(__dirname, '..', 'tests', 'etcd');
var Conflab = require('..');
var conflab = new Conflab();
conflab.load(function(err, config) {
  console.dir(config, false, 4);
  config._.on('change', function() {
    console.log('Config Changed');
    console.dir(config, null, 4);
  });
});

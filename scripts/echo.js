var path = require('path');
process.env.CONFIG = path.join(__dirname,'..','tests','etcd');
var config = require('..');
console.dir(config, false, 4);
config.on('change', function() {
    console.log('Config Changed');
    console.dir(config, null, 4);
})

# conflab

A complex configuration library that you should only use if you want to do things that can't be solved by all the simpler heirarchical json configuration libraries like nconf.

This will load configuration from the following sources, with the later files over-riding any values set in the earlier ones.

1. ./config/default.json
2. ./config/<environment>.json
3. ./config/<your-hostname>.json
4. ./config/runtime.json
5. etcd:/service-name/config**

So by specifying the majority of your configuration in ./config/default.json, you can then override the defaults in the environment or host specific sections using one or more of the other config locations.

### The config object

The config object is returned as a simple immutable JSON object.  Just access the properties you need.

### Example usage (Initalising a new config object)

```js
var config = require('conflab');
app.listen(config.server.port, config.service.host);
```

You can now include this in any module (it is a simple singleton).  We find this pattern avoids you having to pass a config
object around your code which makes it a bit cluttered.

## ETCD

Adding any configuration into etcd (if configured) will trump configuration included in the services themselves.

For the etcd option to work, one of the earlier files must have included etcd connection information:

```
{
    "etcd":{
        "host":"127.0.0.1",
        "port":"4001"
    }
}
```

### Listening for changes

The only additional helper added to the config object is a 'listen', that allows you to register a listener that will be informed if the configuration changes (e.g. someone updates) an etcd key.

If you don't use etcd then ignore this step.

### Etcd

If you use etcd, any changes to the configuration defined in etcd keys.

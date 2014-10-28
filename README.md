# conflab

A complex configuration library that you should only use if you want to do things that can't be solved by all the simpler heirarchical json configuration libraries like nconf.

This will load configuration from the following sources, with the later files over-riding any values set in the earlier ones (think of it as getting more specfic as you go down the list).

1. argv params (--database.host db.example.com)
2. ./config/default.json
3. ./config/[environment>].json
4. ./config/runtime.json
5. ./config/[your-hostname].json
6. etcd:/conflab/service-name/_etcd/environment/config**

So by specifying the majority of your configuration in ./config/default.json, you can then override the defaults in the environment or host specific sections using one or more of the other config locations.

### The config object

The config object is returned as a simple JSON object.  Just access the properties you need.

### Example usage (Initalising a new config object)

```js
var config = require('conflab');
app.listen(config.server.port, config.service.host);
```

You can now include this in any module (it is a simple singleton).  We find this pattern avoids you having to pass a config
object around your code which makes it a bit cluttered.

## ETCD

Adding any configuration into etcd (if configured) will trump configuration included in the services themselves.

This allows you to selectively over-ride any configuration at run time by adding keys into etcd.

For the etcd option to work, one of the earlier files must have included etcd connection information:

```
{
    "etcd":{
        "host":"127.0.0.1",
        "port":"4001"
    }
}
```

### Key structure

The keys in etcd are structured follows:

```
/conflab/<service-name>/_etcd/<environment>/key/path = value
```

Where:

service-name:  the name of the service from its package.json
environment:  the name of the environment

This will over-ride the configuration:

```
{
    "key":{
        "path": "value"
    }
}
```

### Listening for changes

The only additional helper added to the config object is a 'listen', that allows you to register a listener that will be informed if the configuration changes (e.g. someone updates) an etcd key.

```
var config = require('..');
config._.on('change', function() {
    console.log('Config Changed');
})
```

If you don't use etcd then ignore this step.  If you use etcd, any changes to the configuration defined in etcd keys will be immediately reflected when a key is updated in etcd.

### File configuration

To aid in the development of an administration screen, when an application starts up it copies its configuration from each of the local configuration files (if they exist in the environment it is running into) up into etcd (if it is configured):

```
/conflab/<service-name>/_files/<environment>/lib-default
/conflab/<service-name>/_files/<environment>/lib-environment
/conflab/<service-name>/_files/<environment>/default
/conflab/<service-name>/_files/<environment>/environment
/conflab/<service-name>/_files/<environment>/runtime
/conflab/<service-name>/_files/<environment>/hostname-<host>
```

This is done so that you can show the config coming from the application source code alongside any over-rides specified in etcd.

# conflab

A complex configuration library that you should only use if you want to do things that can't be solved by all the simpler hierarchical json configuration libraries like nconf.

This will load configuration from the following sources, with the later files over-riding any values set in the earlier ones (think of it as getting more specfic as you go down the list).

1. options.config
2. ./config/default.json
3. ./config/[environment>].json
5. ./config/runtime.json
6. ./config/[your-hostname].json
7. argv params (--database.host db.example.com)
8. etcd:/conflab/service-name/_etcd/environment/config**

So by specifying the majority of your configuration in ./config/default.json, you can then override the defaults in the environment or host specific sections using one or more of the other config locations.

### Additional files

Any of the config files can also specify additional files to be loaded after it. This is expressed by setting `CF_additionalFiles` field.

#### Example

```json
{
    "key": "value",
    "CF_additionalFiles": ["../config.json", "/etc/app/pass.json"]
}
```

### The config object

The config object is returned as a simple JSON object.  Just access the properties you need.

### Example usage (Initalising a new config object)

```js
var Conflab = require('conflab');
var conflab = new Conflab();
conflab.load(function(err, config) {
    app.listen(config.server.port, config.service.host);
});
```

## ETCD

Adding any configuration into etcd (if configured) will trump configuration included in the services themselves.

This allows you to selectively over-ride any configuration at run time by adding keys into etcd.

For the etcd option to work, one of the earlier files must have included etcd connection information:

```json
{
    "etcd":{
        "hosts": ["127.0.0.1:4001"]
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

```json
{
    "key":{
        "path": "value"
    }
}
```

### Listening for changes

The only additional helper added to the config object is a 'listen', that allows you to register a listener that will be informed if the configuration changes (e.g. someone updates) an etcd key.

```js
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

####  Controlling file export to etcd

`CF_exportToEtcd` field can be used to explicitly control if a file should be copied to etcd. If the field is not set conflab will copy all "regular" config files (default.json, [environment].json, runtime.json etc.) to etcd and not copy any of the "additonal" config files (specified in `CF_additionalFiles`).
The default behaviour caters to the use case where sensitive information is kept in files outside of version control and should not be exported and shared.

##### Example

```json
{
    "CF_exportToEtcd": false,
    "foo": "bar"
}
```

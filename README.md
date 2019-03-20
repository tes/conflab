# conflab

A complex configuration library that you should only use if you want to do things that can't be solved by all the simpler hierarchical json configuration libraries like nconf.

This will load configuration from the following sources, with the later files over-riding any values set in the earlier ones (think of it as getting more specfic as you go down the list).

1. options.config
2. ./config/default.json
3. ./config/[environment>].json
5. ./config/runtime.json
6. ./config/[your-hostname].json
7. argv params (--database.host db.example.com)
8. options.overrides

So by specifying the majority of your configuration in ./config/default.json, you can then override the defaults in the environment or host specific sections using one or more of the other config locations.

### API Change 0.x.x => 1.x.x
1. Merging of configuration no longer merges arrays, it replaces them. Old behaviour: `{ a: ['a', 'b'] }` `+` `{ a: ['c'] }` `->` `{ a: ['c', 'b'] }`, new behaviour: `{ a: ['a', 'b'] }` `+` `{ a: ['c'] }` `->` `{ a: ['c'] }`

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

### Defaults and overrides
Conflab expects an options object which can provide defaults and/or overrides. The defaults can be overriden by any other configuration values stated in files, argv or override. The overrides override any other configuration value. 

#### Example of the options object
```
{
    config:{
        key1: 'value1',
        key2: 'value2',
    },
    overrides: {
        key2: 'value3',
    },
}
```

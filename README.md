# module-tsl-config

A thin wrapper for [nconf](https://github.com/flatiron/nconf) which attempts to overlay json configuration from the following locations.

1. The path specified by --config
2. ./config/<your-hostname>.json
3. ./config/runtime.json
3. ./config/<environment>.json
4. ./config/default.json

So by specifying the majority of your configuration in ./config/default.json, you can override environment or host specific sections using one or more of the other config locations.

### Example usage (Initalising a new config object)

```js
var config = require('module-tsl-config');
app.listen(config.server.port, config.service.host);
```
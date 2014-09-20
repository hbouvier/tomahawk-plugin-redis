# Tomahawk Redis Store plugin

## To use this plugin

    npm install -g tomahawk-routes-kv-store
    npm install -g tomahawk-plugin-redis

Then create a configuration file in your home directory:

    ~/.tomahawk/config.json
    {
        "plugins" : {
            "store" : {
                "context"        : "/store/api/v1",
                "implementation" : "tomahawk-plugin-redis",
                "url"            : "redis://localhost:6379/0"
            },
            "store-route" : {
                "implementation" : "tomahawk-routes-kv-store"
            }
        }
    }
module.exports = function () {
    var util   = require('util'),
        redis  = require('redis');

    function isUndefined(object) { return typeof(object) === 'undefined'; }
    function create(app, config) {
        var connected = false,
            debug     = 0,
            client    = null,
            version  = config.version        || '0.0.0',
            logger   = config.logger         || {log:function(){}},
            meta     = config.meta           || {$_id:'redis'};

        function status(next) {
            process.nextTick(function () {
                var result = {status: connected ? "OK" : "DISCONNECTED"};
                logger.log('debug', 'redis::status|status=%j', result, meta);
                if (next) next(null, result);
            });
        }

        function connect(url, next) {
             var regex_  = /^redis:\/\/(?:([^:]*):([^@]*)@)?([^:]*):([^\/]*)(?:\/(.*))?$/,
                 capture = url.match(regex_),
                 info    = {},
                 options = {},
                 called  = false;

             if (capture !== null && capture[0] !== undefined && capture.length === 6) {
                info.user     = capture[1];
                info.password = capture[2];
                info.host     = capture[3];
                info.port     = parseInt(capture[4]);
                info.database = parseInt(capture[5] || 0);
             }

             if (info.password)
                options.auth_pass = true;
            if (debug) util.log("redis::connect|info=" + JSON.stringify(info));
            client = redis.createClient(info.port, info.host, options);
            if (info.password) {
                client.auth(info.password, function (err) {
                    if (debug) util.log('redis::auth|' + (err ? 'ERROR=' : ''), (err ? err : 'OK'));
                });
            }
            client.select(info.database, function (err) {
                if (err)
                    util.log('redis::select|database=' + info.database + '|FAILED=' + util.inspect(err));
                if (debug && !err) util.log('redis::select|database=' + info.database + '|SELECTED');
            });

            client.on("connect", function () {
                if (debug) util.log('redis::event|connect');
            });
            client.on("ready", function () {
                connected = true;
                if (debug) util.log('redis::event|ready');
                if (called === false) {
                    called = true;
                    process.nextTick(function () {
                        if (next)
                            next();
                    });
                }
            });
            client.on("error", function (err) {
                util.log('redis::event|ERROR=', err);
                if (called === false) {
                    process.nextTick(function () {
                        if (next)
                            next(new Error("Unable to connect!"));
                    });
                }
            });
            client.on("end", function () {
                connected = false;
                if (debug) util.log('redis::event|end');
                if (called === false) {
                    process.nextTick(function () {
                        if (next)
                            next(new Error("Unable to connect!"));
                    });
                }
            });
            client.on("drain", function () {
                if (debug) util.log('redis::event|drain');
            });
            client.on("idle", function () {
                if (debug) util.log('redis::event|idle');
            });
        }

        function close(next) {
            connected = false;
            client.end(function (err) {
                if (next) next(err);
            });
            client = null;
            logger.log('info', 'redis::close', meta);
        }

        function get(key, next) {
            if (key.indexOf('*') !== -1) {
                client.keys(key, function (err, keys) {
                    if (err)
                        return next(err)
                    client.mget(keys, function (err, values) {
                        if (err)
                            return next(err)

                        var tuples = [];
                        for(var i = 0 ; i < keys.length && i < values.length ; ++i) {
                            tuples.push({key:keys[i], value:values[i]});
                        }
                        return next(null, tuples);
                    });
                });
            } else {
                client.get(key, next);
            }
        }

        function set(tuples, next) {
            if (debug) util.log('redis::set|tuples=' + JSON.stringify(tuples));
            var listOfKeyValues = tuples.map(function (tuple) {
                return [tuple.key, tuple.value];
            });
            var args = [].concat.apply([], listOfKeyValues);
            args.push(next);

            client.mset.apply(client, args);
        }

        function del(key, next) {
            function delArray(keys, next) {
                keys.push(next);
                client.del.apply(client, keys);
            }

            if (key instanceof Array) {
                logger.log('debug', 'redis::del|keys=%j', key, meta);
                return delArray(key, next);
            } else if (key.indexOf('*') !== -1) {
                logger.log('debug', 'redis::del|keys=%j', key, meta);
                client.keys(key, function (err, keys) {
                    logger.log('debug', 'redis::del|keys=%j|%j', keys, (err ? err : ''), meta);
                    if (err)
                        return next(err);
                    return delArray(keys, next);
                });
            } else {
                logger.log('debug', 'redis::del|keys=%j', [key], meta);
                return delArray([key], next);
            }
        }

        function sget(setName, member, next) {
            logger.log('debug', 'redis::sget(setName:%s, member: %s)', setName, member, meta);
            if (member === '*') {
                client.smembers(setName, function (err, values) {
                    logger.log('debug', 'redis::sget(setName:%s, member: %s) >>> %j', setName, member, values, meta);
                    next(null, values);
                });
            } else {
                client.sismember(setName, member, function (err, found) {
                    logger.log('debug', 'redis::sget(setName:%s, member: %s) >>> %j', setName, member, found, meta);
                    if (err)
                        return next(err);
                    next(null, +found === 0 ? false : true);
                })
            }
        }

        function sadd(tuples, next) {
            if (tuples.length > 0) {
                var args = tuples.map(function (tuple) {
                    return tuple.value;
                });
                args.unshift(tuples[0].key)
                args.push(next);
                client.sadd.apply(client, args);
            } else {
                next(null, 'OK');
            }
        }
        
        function sdel(setName, member, next) {
            if (member === '*') {
                logger.log('debug', 'redis::sdel(del)|set=%s|member=%s', setName, member, meta);
                client.del(setName, function (err, value) {
                    return next(err, value);
                });
            } else {
                logger.log('debug', 'redis::sdel(srem)|set=%s|member=%s', setName, member, meta);
                client.srem(setName, member, function (err, value) {
                    return next (err, value);
                });
            }
        }



        ////////////////////////////////////////////////////////////////////////

        return {
            constructor : function (next) {
                connect(process.env.REDIS_URL || config.plugins.store.url, next);
            },
            shutdown : function (next) {
                close(next);
            },
            status  : status,
            connect : connect,
            close   : close,
            get     : get,
            set     : set,
            del     : del,
            sadd    : sadd,
            sget    : sget,
            sdel    : sdel
        };
    }

    return create;
}();

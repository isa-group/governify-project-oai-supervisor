'use strict';
var request = require('request');
var config = require('../../config');
var logger = require('../../config').logger;
var moment = require('moment');
var Promise = require("bluebird");

exports.checkPOST = function (args, res, next) {
    /**
     * parameters expected in the args:
    * requestInfo (RequestInfo)
    **/
    if (args.requestInfo.value) {
        var requestInfo = args.requestInfo.value;
        logger.checkCtl("New request to check SLA with: ");
        logger.debug(JSON.stringify(requestInfo, null, 2));

        getAgreementById(requestInfo, (agreement) => {
            //Send before check metrics
            sendPreCheckMetrics(requestInfo, agreement, (success) => {
                //requestState with specific scope
                getStateByAgreement(requestInfo, agreement, (states) => {
                    var fulfilled = true;
                    var excededLimits = [];
                    logger.checkCtl("Checking if fulfilled...");
                    for (var state in states) {
                        fulfilled = fulfilled && states[state].value;
                        if (!states[state].value) excededLimits.push(states[state]);
                    }
                    if (fulfilled) {
                        logger.checkCtl("Request accepted (OK)");

                        //create response
                        var slaStatus = new status(true, [], [], {}, []);

                        //add configuration
                        slaStatus.addConfigurations(agreement.terms.configurations);

                        //add requestedMetrics
                        slaStatus.addMetrics(agreement.terms.metrics);

                        res.json(slaStatus);
                    } else {
                        logger.checkCtl("Request denied (NO FULFILLED)");

                        //create response
                        var slaStatus = new status(false, [], [], {}, [], 'limits exceded');

                        //addQuotas
                        logger.debug("Limit execeded:" + JSON.stringify(excededLimits));
                        slaStatus.addQuotas(agreement.terms.quotas, excededLimits.filter((element) => {
                            return element.stateType == "quotas";
                        }));
                        //addRates
                        slaStatus.addRates(agreement.terms.rates, excededLimits.filter((element) => {
                            return element.stateType == "rates";
                        }));

                        res.json(slaStatus);
                    }

                }, (error, response, body) => {

                    if (!error && response.statusCode == 404) {
                        res.json(new status(false, [], [], {}, [], requestInfo.sla + ' does not exist'));
                    } else {
                        res.json(new status(false, [], [], {}, [], error.toString()));
                    }

                });
            }, (err) => {
                res.json(new status(false, [], [], {}, [], err.toString()));
            });


        }, (error, response, body) => {

            if (!error && response.statusCode == 404) {
                res.json(new status(false, [], [], {}, [], requestInfo.sla + ' does not exist'));
            } else {
                res.json(new status(false, [], [], {}, [], 'Unexpected error'));
            }

        });

    } else {
        res.status(400);
        res.json(new error(400, "Bad request, you need to pass requestInfo in the body"));
    }

}


function getStateByAgreement(requestInfo, agreement, successCb, errorCb) {
    var quotasUri = config.services.registry.uri + config.services.registry.apiVersion + "/states/" + requestInfo.sla + "/quotas";
    var ratesUri = config.services.registry.uri + config.services.registry.apiVersion + "/states/" + requestInfo.sla + "/rates";
    logger.checkCtl("Getting State of %s from registry (url = %s)", requestInfo.sla, config.services.registry.uri + config.services.registry.apiVersion + "/states/" + requestInfo.sla + "/...");
    var scopes = [
        { uri: quotasUri, scope: { resource: requestInfo.resource.split('?')[0], operation: requestInfo.method.toLowerCase(), level: "account", account: requestInfo.scope.account } },
        { uri: quotasUri, scope: { resource: requestInfo.resource.split('?')[0], operation: requestInfo.method.toLowerCase(), level: "tenant", account: agreement.context.consumer } },
        { uri: ratesUri, scope: { resource: requestInfo.resource.split('?')[0], operation: requestInfo.method.toLowerCase(), level: "account", account: requestInfo.scope.account } },
        { uri: ratesUri, scope: { resource: requestInfo.resource.split('?')[0], operation: requestInfo.method.toLowerCase(), level: "tenant", account: agreement.context.consumer } }
    ];

    var states = [];
    Promise.each(scopes, (scope) => {

        return new Promise((resolve, reject) => {
            logger.checkCtl("with scope: " + JSON.stringify(scope));
            request.post({ url: scope.uri, json: true, body: { scope: scope.scope } }, (error, response, body) => {
                if (!error) {
                    if (response.statusCode == 200) {
                        logger.checkCtl("Registry has responded successfuly");
                        logger.debug(JSON.stringify(body));
                        return resolve(body);
                    } else {
                        logger.error("Error retriving state: " + JSON.stringify(response));
                        return reject(null, response, body);
                    }
                } else {
                    logger.error("Error retriving state: " + JSON.stringify(error));
                    return reject(error, body);
                }
            });
        }).then((success) => {
            success.forEach((element) => {
                states.push(element);
            });
        }, (err) => {
            errorCb(err);
        });

    }).then((success) => {
        logger.checkCtl("All states have been retrived");
        logger.debug(JSON.stringify(states));
        successCb(states);
    }, (err) => {
        errorCb(err);
    });

}

function getAgreementById(requestInfo, successCb, errorCb) {
    var uri = config.services.registry.uri + config.services.registry.apiVersion + "/agreements/" + requestInfo.sla;
    logger.checkCtl("Getting SLA from registry (url = %s)", uri);

    request.get({ url: uri, json: true }, (error, response, body) => {
        if (!error) {
            if (response.statusCode == 200) {
                logger.checkCtl("Response from registry: ");
                logger.debug(JSON.stringify(body));
                successCb(body);
            } else {
                logger.error("Error retriving agreement definition: " + JSON.stringify(response));
                errorCb(null, response, body);
            }
        } else {
            logger.error("Error retriving agreement definition: " + JSON.stringify(error));
            errorCb(error, body);
        }
    });
}

function sendPreCheckMetrics(requestInfo, agreement, successCb, errorCb) {
    var queries = [];
    var scopes = [{ resource: requestInfo.resource.split('?')[0], operation: requestInfo.method.toLowerCase(), level: "account", account: requestInfo.scope.account },
    { resource: requestInfo.resource.split('?')[0], operation: requestInfo.method.toLowerCase(), level: "tenant", account: agreement.context.consumer }];

    logger.checkCtl("Looking for periords in agreement...");
    for (var m in requestInfo.metrics) {
        var metric = requestInfo.metrics[m];
        logger.checkCtl("Looking for metric = %s ==> value = %s", m, metric);
        scopes.forEach((scope) => {
            logger.checkCtl("Looking for scope = %s, %s, %s, %s", scope.resource, scope.operation, scope.level, scope.account);
            var periods = getPeriodsByScope(scope, agreement, m);
            if (!periods)
                logger.checkCtl("Not found limits for scope: %s", JSON.stringify(scope, null, 2));
            else {
                logger.debug(JSON.stringify(periods, null, 2));
                logger.checkCtl("Creating queries.");
                for (var p in periods) {
                    var period = periods[p];
                    var query = {};
                    query.scope = scope;
                    if (period.period)
                        query.window = { type: period.type, period: period.period };

                    if (!metric)
                        query.value = 0;
                    else {
                        query.value = metric;
                    }

                    queries.push(new Promise((resolve, reject) => {
                        var uri = config.services.registry.uri + config.services.registry.apiVersion + "/states/" + agreement.id + "/metrics/" + m;
                        logger.checkCtl("Sending request ( url = %s )", uri);
                        if (query.window) {
                            request.post({ url: uri + "/increase", json: true, body: query }, (error, response, body) => {
                                if (!error) {
                                    if (response.statusCode == 200) {
                                        logger.checkCtl("Response from registry: ");
                                        logger.debug(JSON.stringify(body));
                                        return resolve(body);
                                    } else {
                                        logger.error("Error retriving state: " + JSON.stringify(response));
                                        return reject(response);
                                    }
                                } else {
                                    logger.error("Error retriving state: " + JSON.stringify(error));
                                    return reject(error);
                                }
                            });
                        } else {
                            request.put({ url: uri, json: true, body: query }, (error, response, body) => {
                                if (!error) {
                                    if (response.statusCode == 200) {
                                        logger.checkCtl("Response from registry: ");
                                        logger.debug(JSON.stringify(body));
                                        return resolve(body);
                                    } else {
                                        logger.error("Error retriving state: " + JSON.stringify(response));
                                        return reject(response);
                                    }
                                } else {
                                    logger.error("Error retriving state: " + JSON.stringify(error));
                                    return reject(error);
                                }
                            });
                        }
                    }));
                }
            }
        });
    }

    Promise.all(queries).then((success) => { successCb(success) }, (err) => { errorCb(err) });

}

function error(code, message) {
    this.code = code;
    this.message = message;
}

function status(accept, quotas, rates, configuration, requestedMetrics, reason) {
    var periodToAdd = { secondly: "seconds", minutely: "minutes", hourly: "hours", daily: "days", weekly: "weeks", monthly: "months", yearly: "years" };
    var periodToSetNow = { secondly: "second", minutely: "minute", hourly: "hour", daily: "day", weekly: "week", monthly: "month", yearly: "year" };

    this.accept = accept;
    if (reason)
        this.reason = reason;
    this.quotas = quotas;
    this.rates = rates;
    this.configuration = configuration;
    this.requestedMetrics = requestedMetrics;
    this.addConfigurations = function (configurations) {
        for (var config in configurations) {
            var configuration = configurations[config];
            this.configuration[config] = configuration.of[0].value;
        }
    };
    this.addMetrics = function (metrics) {
        for (var m in metrics) {
            var metric = metrics[m];
            if (metric.type == "consumption")
                this.requestedMetrics.push(m);
        }
    };
    this.addQuotas = function (quotasDefs, states) {
        for (var qS in states) {
            var qState = states[qS];
            var window = qState.window;
            var metric = Object.keys(qState.metrics)[0];
            var awaitTo = window ? moment.utc().startOf(periodToSetNow[window.period]).add(1, periodToAdd[window.period]) : null;
            this.quotas.push(new limit(qState.scope.resource, qState.scope.operation, metric, qState.max, qState.metrics[metric], awaitTo));
        }
    };
    this.addRates = function (ratesDefs, states) {
        for (var rS in states) {
            var rState = states[rS];
            var window = rState.window;
            var metric = Object.keys(rState.metrics)[0];
            var awaitTo = window ? moment.utc().startOf(periodToSetNow[window.period]).add(1, periodToAdd[window.period]) : null;
            this.rates.push(new limit(rState.scope.resource, rState.scope.operation, metric, rState.max, rState.metrics[metric], awaitTo));
        }
    };
}

function limit(resource, method, metric, limit, used, awaitTo) {
    this.resource = resource;
    this.method = method;
    this.metric = metric;
    this.limit = limit;
    this.used = used;
    if (awaitTo)
        this.awaitTo = awaitTo;
}

function getPeriodsByScope(scope, agreement, metric) {
    var periords = [];
    //adding quotas period
    var quotasPeriods = agreement.terms.quotas.filter((element) => {
        return element.over[metric] ? true : false;
    }).map((element) => {
        return element.of;
    })[0]
    quotasPeriods = (quotasPeriods ? quotasPeriods : []).filter((element) => {
        return element.scope.resource === scope.resource && element.scope.operation === scope.operation && element.scope.level === scope.level;
    }).map((element) => {
        return element.limits;
    })[0];
    if (quotasPeriods)
        quotasPeriods.forEach((element) => {
            element.type = "static";
            periords.push(element);
        });
    //adding rates period
    var ratesPeriods = agreement.terms.rates.filter((element) => {
        return element.over[metric] ? true : false;
    }).map((element) => {
        return element.of;
    })[0]
    ratesPeriods = (ratesPeriods ? ratesPeriods : []).filter((element) => {
        return element.scope.resource === scope.resource && element.scope.operation === scope.operation && element.scope.level === scope.level;
    }).map((element) => {
        return element.limits;
    })[0];
    if (ratesPeriods)
        ratesPeriods.forEach((element) => {
            element.type = "dynamic";
            periords.push(element);
        });
    return periords;
}

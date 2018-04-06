'use strict';
var request = require('request');
var config = require('../../config');
var logger = config.logger;

exports.tenantsGET = function (args, res, next) {
    /**
     * parameters expected in the args:
     * apikey (String)
     * account (String)
     **/
    var service = args.service.value;

    logger.tenantsCtl("New request to get tenant info.");
    if (args.apikey.value) {
        var apikey = args.apikey.value;
        logger.tenantsCtl(" ( apikey mode ) with values = %s ", apikey);
        resolveTenantByApikey(apikey, (err, body) => {
            logger.debug(" ( tenantsGET ) body result: " + JSON.stringify(body, null, 2));
            if (!err) {
                if (body.length != 0) {
                    var e = true;
                    for (var tn in body) {
                        var t = new tenant(body[tn].agreement, body[tn].scope);
                        if (t.scope.service == service) {
                            t.setUpRequestedMetrics((success) => {
                                logger.tenantsCtl("Response body = %s ", JSON.stringify(t, null, 2));
                                return res.json(t);
                            }, (err) => {
                                logger.error(JSON.stringify(err, null, 2));
                                if (err.code) {
                                    return res.status(err.code).json(new error(err.code, err.message));
                                } else {
                                    return res.status(500).json(new error(500, "No response code from the request to get tenant info."));
                                }
                            });
                            e = e && false;
                        } else {
                            e = e && true;
                        }
                    }
                    if (e) {
                        logger.error("Not Found tenant with this scope information");
                        res.status(404).json(new error(404, "Not Found tenant with this scope information"));
                    }
                } else {
                    res.status(404).json(new error(404, "Not Found tenant with this scope information"));
                    logger.error("Not Found tenant with this scope information");
                }
            } else {
                res.status(500);
                res.json(new error(500, err));
                logger.error(JSON.stringify(err, null, 2));
            }
        });
    } else {
        if (args.account.value) {
            var account = args.account.value;
            logger.tenantsCtl(" ( account mode ) with values = %s ", account);
            resolveTenantByAccount(account, (err, body) => {
                logger.debug(" ( tenantsGET ) body result: " + JSON.stringify(body, null, 2));
                if (!err)
                    if (body.length != 0) {
                        for (var tn in body) {
                            var t = new tenant(body[tn].agreement, body[tn].scope);
                            if (t.scope.service == service) {
                                t.setUpRequestedMetrics((success) => {
                                    logger.tenantsCtl("Response body = %s ", JSON.stringify(t, null, 2));
                                    return res.json(t);
                                }, (err) => {
                                    logger.error(JSON.stringify(err, null, 2));
                                    if (err.code) {
                                        return res.status(err.code).json(new error(err.code, err.message));
                                    } else {
                                        return res.status(500).json(new error(500, "No response code from the request to get tenant info."));
                                    }
                                });
                                e = e && false;
                            } else {
                                e = e && true;
                            }
                        }
                        if (e) {
                            logger.error("Not Found tenant with this scope information");
                            res.status(404).json(new error(404, "Not Found tenant with this scope information"));
                        }
                    } else {
                        res.status(404).json(new error(404, "Not Found tenant with this scope information"));
                        logger.error("Not Found tenant with this scope information");
                    }
                else {
                    res.status(500);
                    res.json(new error(500, err.toString()));
                    logger.error(JSON.stringify(err, null, 2));
                }
            });
        } else {
            res.status(400);
            res.json(new error(400, "Bad request, you need to pass apikey or account in a query parameter"));
            logger.error(JSON.stringify("Bad request, you need to pass apikey or account in a query parameter", null, 2));
        }
    }

}

exports.tenantsPOST = function (args, res, next) {
    /**
     * parameters expected in the args:
     * tenant (newTenant)
     **/
    logger.tenantsCtl("New request to POST tenant info.");
    if (args.tenant.value) {
        var newTenant = args.tenant.value
        var newTenant = new governifyTenant(newTenant.sla, newTenant.scope);
        logger.tenantsCtl("New tenant values = %s", JSON.stringify(newTenant, null, 2));

        logger.tenantsCtl("Sending POST ( url = %s )", config.services.tenants.uri + config.services.tenants.apiVersion + "/tenants");
        var r = request.post({
            url: config.services.tenants.uri + config.services.tenants.apiVersion + "/tenants",
            body: newTenant,
            json: true
        }, (err, response, body) => {
            if (!err && response.statusCode == 200) {
                logger.tenantsCtl("New tenant has been created");
                res.end();
            } else {
                logger.error("Error: %s, %s", response.statusCode, JSON.stringify(body, null, 2));
                res.status(response.statusCode);
                res.json(new error(response.statusCode, body));
            }
        });
    }

}

function resolveTenantByAccount(account, callback) {
    getTenant("account", account, (err, body) => {
        callback(err, body);
    });
}

function resolveTenantByApikey(apikey, callback) {
    getTenant("apikey", apikey, (err, body) => {
        callback(err, body);
    });
}

function getTenant(keyName, keyValue, callback) {
    var url = config.services.tenants.uri + config.services.tenants.apiVersion + "/tenants";
    var req = request(url, {
        qs: {
            keyName: keyName,
            keyValue: keyValue
        },
        json: true
    }, (err, response, body) => {
        callback(err, body);
    });
}

function error(code, message) {
    this.code = code;
    this.message = message;
}

function governifyTenant(sla, scope) {
    this.agreement = sla,
        this.scope = scope;
}

function tenant(sla, scope) {
    this.sla = sla,
        this.scope = scope;
    this.requestedMetrics = [];
    this.setUpRequestedMetrics = function (successCb, errorCb) {
        var uri = config.services.registry.uri + config.services.registry.apiVersion + "/agreements/" + this.sla;
        logger.tenantsCtl("Getting agreement info for id = %s ( uri = %s )", sla, uri);
        request.get({
            url: uri,
            json: true
        }, (err, response, body) => {
            if (err) {
                logger.tenantsCtl("Error while it is retriving agreement %s", JSON.stringify(err, null, 2));
                return errorCb(err);
            } else {
                if (response.statusCode !== 200) {
                    logger.tenantsCtl("Error while it is retriving agreement %s", JSON.stringify(body, null, 2));
                    return errorCb(body);
                } else {
                    var metrics = body.terms.metrics;
                    logger.tenantsCtl("Building requestedMetrics");
                    if (!metrics) return logger.tenantsCtl("There are no metrics");
                    for (var m in metrics) {
                        var metric = metrics[m];
                        if (metric.type === "check")
                            this.requestedMetrics.push(m);
                    }
                    logger.tenantsCtl("requestedMetrics = %s", JSON.stringify(this.requestedMetrics));
                    return successCb();
                }
            }
        });
    }
}

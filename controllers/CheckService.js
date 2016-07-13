'use strict';
var request = require('request');
var config = require('../config');
var logger = require('../config').logger;
var moment = require('moment');

exports.checkPOST = function(args, res, next) {
    /**
     * parameters expected in the args:
    * requestInfo (RequestInfo)
    **/
    if(args.requestInfo.value){
        var requestInfo = args.requestInfo.value;
        logger.checkCtl("New request to check SLA with: ");
        logger.debug(JSON.stringify(requestInfo, null, 2));
        //First update before check Metrics on registry

        getAgreementById(requestInfo, (agreement) => {
            //requestState with specific scope
            getStateByAgreement(requestInfo, (states) => {
                var fulfilled = true;
                var excededLimits = [];
                logger.checkCtl("Checking if fulfilled...");
                for(var state in states){
                    fulfilled = fulfilled && states[state].value;
                    if(!states[state].value) excededLimits.push(states[state]);
                }
                if(fulfilled){
                    logger.checkCtl("Request accepted (OK)");

                    //create response
                    var slaStatus = new status( true, [], [], {}, [] );

                    //add configuration
                    slaStatus.addConfigurations(agreement.terms.configurations);

                    //add requestedMetrics
                    slaStatus.addMetrics(agreement.terms.metrics);

                    res.json( slaStatus );
                }else {
                   logger.checkCtl("Request denied (NO FULFILLED)");

                    //create response
                    var slaStatus = new status( false, [], [], {}, [], 'limits exceded' );

                    //addQuotas
                    logger.debug("Limit execeded:"  + JSON.stringify(excededLimits));
                    slaStatus.addQuotas(agreement.terms.quotas, excededLimits.filter((element)=>{
                        return element.stateType == "quotas";
                    }));
                    //addRates
                    slaStatus.addRates(agreement.terms.rates,excededLimits.filter((element)=>{
                        return element.stateType == "rates";
                    }));

                    res.json(slaStatus);
                }

            }, (error, response, body) => {

                if(!error && response.statusCode == 404){
                    res.json( new status( false, [], [], {}, [], requestInfo.sla + ' does not exist'));
                }else{
                    res.json( new status( false, [], [], {}, [], error.toString()));
                }

            });

        }, (error, response, body) => {

            if(!error && response.statusCode == 404){
                res.json( new status( false, [], [], {}, [], requestInfo.sla + ' does not exist'));
            }else{
                res.json( new status( false, [], [], {}, [], 'Unexpected error'));
            }

        });

    }else{
        res.status(400);
        res.json(new error(400, "Bad request, you need to pass requestInfo in the body"));
    }

}


function getStateByAgreement(requestInfo, successCb, errorCb){
    var uri = config.services.registry.uri + config.services.registry.apiVersion + "/states/" + requestInfo.sla + "/quotas/quotas_requests";
    logger.checkCtl("Getting State of %s from registry (url = %s)",  requestInfo.sla, uri);
    var scope = {resource: requestInfo.resource, operation: requestInfo.method};
    logger.checkCtl("with scope: " +  JSON.stringify(scope));

    request.post({url : uri, json: true, body: {scope}}, (error, response, body) => {
        if(!error){
            if(response.statusCode == 200){
                logger.checkCtl("Response from registry: ");
                logger.debug(JSON.stringify(body));
                successCb(body);
            }else{
                logger.error("Error retriving state: " + JSON.stringify(response));
                errorCb(null, response, body);
            }
        }else{
            logger.error("Error retriving state: " + JSON.stringify(error));
            errorCb(error, body);
        }
    });
}

function getAgreementById(requestInfo, successCb, errorCb){
    var uri = config.services.registry.uri + config.services.registry.apiVersion + "/agreements/" + requestInfo.sla ;
    logger.checkCtl("Getting SLA from registry (url = %s)", uri);

    request.get({url : uri, json: true}, (error, response, body) => {
        if(!error){
            if(response.statusCode == 200){
                logger.checkCtl("Response from registry: ");
                logger.debug(JSON.stringify(body));
                successCb(body);
            }else{
                logger.error("Error retriving agreement definition: " + JSON.stringify(response));
                errorCb(null, response, body);
            }
        }else{
            logger.error("Error retriving agreement definition: " + JSON.stringify(error));
            errorCb(error, body);
        }
    });
}

function error (code, message){
    this.code = code;
    this.message = message;
}

function status(accept, quotas, rates, configuration, requestedMetrics, reason ){
    this.accept = accept;
    if(reason)
      this.reason = reason;
    this.quotas = quotas;
    this.rates = rates;
    this.configuration = configuration;
    this.requestedMetrics = requestedMetrics;
    this.addConfigurations = function (configurations){
        for(var config in configurations){
            var configuration = configurations[config];
            this.configuration[config] = configuration.of[0].value;
        }
    };
    this.addMetrics = function (metrics){
        for(var m in metrics){
          var metric = metrics[m];
          if(metric.type == "consumption")
            this.requestedMetrics.push(m);
        }
    };
    this.addQuotas = function (quotasDefs, states){
        var periodToAdd = {secondly: "seconds", minutely: "minutes", hourly: "hours", daily: "days", weekly: "weeks", monthly: "months", yearly: "years"};
        var periodToSetNow = {secondly: "second", minutely: "minute", hourly: "hour", daily: "day", weekly: "week", monthly: "month", yearly: "year"};
        for (var qS in states){
            var qState = states[qS];
            var window = qState.window;
            var metric = Object.keys(qState.metrics)[0];
            this.quotas.push( new limit(qState.scope.resource, qState.scope.operation, metric, qState.max, qState.metrics[metric], moment.utc().startOf(periodToSetNow[window.period]).add(1, periodToAdd[window.period] )) );
        }
    };
    this.addRates = function (reatesDefs, state){

    };
}

function limit(resource, method, metric, limit, used, awaitTo){
    this.resource = resource;
    this.method = method;
    this.metric = metric;
    this.limit = limit;
    this.used = used;
    if(awaitTo)
      this.awaitTo = awaitTo;
}

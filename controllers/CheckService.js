'use strict';
var request = require('request');
var config = require('../config');
var iso8601 = require('iso8601');

exports.checkPOST = function(args, res, next) {
    /**
     * parameters expected in the args:
    * requestInfo (RequestInfo)
    **/
    if(args.requestInfo.value){
        var requestInfo = args.requestInfo.value;

        //First update before check Metrics on registry

        getAgreementById(requestInfo, (agreement) => {
            //requestState with specific scope
            getStateByAgreement(requestInfo, (state) => {

                if(state.fulfilled === true){
                    console.log("accepted");

                    //create response
                    var slaStatus = new status( true, [], [], {}, [] );

                    //add configuration
                    slaStatus.addConfigurations(agreement.terms.configurations);

                    //add requestedMetrics
                    slaStatus.addMetrics(agreement.terms.metrics);

                    res.json( slaStatus );
                }else {
                    console.log("denied");

                    //create response
                    var slaStatus = new status( false, [], [], {}, [], 'limits execeded' );

                    //addQuotas
                    slaStatus.addQuotas(agreement.terms.quotas, state);
                    //addRates
                    slaStatus.addRates(agreement.terms.rates, state);

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
    var uri = config.services.registry.uri + config.services.registry.apiVersion + "/states/" + requestInfo.sla;

    request.get({url : uri, json: true}, (error, response, body) => {
        if(!error){
            if(response.statusCode == 200){
                successCb(body);
            }else{
                errorCb(null, response, body);
            }
        }else{
            errorCb(error, body);
        }
    });
}

function getAgreementById(requestInfo, successCb, errorCb){
    var uri = config.services.registry.uri + config.services.registry.apiVersion + "/agreements/" + requestInfo.sla;

    request.get({url : uri, json: true}, (error, response, body) => {
        if(!error){
            if(response.statusCode == 200){
                successCb(body);
            }else{
                errorCb(null, response, body);
            }
        }else{
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
            this.configuration[config] = configuration.of['*'];
        }
    };
    this.addMetrics = function (metrics){
        for(var m in metrics){
          var metric = metrics[m];
          if(metric.type == "consumption")
            this.requestedMetrics.push(m);
        }
    };
    this.addQuotas = function (quotasDefs, state){
        for (var qS in state.quotas){
            var qState = state.quotas[qS];
            if(qState.fulfilled === false){
                for(var qD in quotasDefs){
                   var qDef = quotasDefs[qD];
                   if(qState.quota === qDef.id){
                       //level passing request scope (now static)
                       var scope = qState.scope.resource + ',' + qState.scope.operation.toLowerCase() + ',' + qState.scope.level;
                       //over tiene que modificarse
                       var metric = null;
                       for(var m in state.metrics){
                          var aux = state.metrics[m];
                          if(aux.metric == Object.keys(qDef.over)[0] && aux.scope.resource == qState.scope.resource
                              && aux.scope.operation == qState.scope.operation && aux.scope.level == qState.scope.level )
                            metric = aux;
                       }
                       //elavorate with period
                       var awaitTo = null;
                       if(qDef.of[scope].limits[0].period){
                          switch (qDef.of[scope].limits[0].period) {
                            case 'secondly':
                              awaitTo = new Date(iso8601.toDate(state.time).getTime() + 1000);
                              break;
                            case 'minutely':
                              awaitTo = new Date(iso8601.toDate(state.time).getTime() + (60 * 1000));
                              break;
                            case 'hourly':
                              awaitTo = new Date(iso8601.toDate(state.time).getTime() + (60 * 60 * 1000));
                              break;
                            case 'daily':
                              awaitTo = new Date(iso8601.toDate(state.time).getTime() + (24 * 60 * 60 * 1000));
                              break;
                            case 'monthly':
                              awaitTo = new Date(iso8601.toDate(state.time).getTime() + (30 * 24 * 60 * 60 * 1000));
                              break;
                            case 'yearly':
                              awaitTo = new Date(iso8601.toDate(state.time).getTime() + (12 * 30 * 24 * 60 * 60 * 1000));
                              break;
                            default:
                              break;
                          }
                       }
                       this.quotas.push(new limit(
                            qState.scope.resource,
                            qState.scope.operation,
                            metric.metric,
                            qDef.of[scope].limits[0].max, metric.value, awaitTo ? iso8601.fromDate(awaitTo) : null
                          )
                      );
                  }
                }
            }
        }
    };
    this.addRates = function (reatesDefs, state){
        for (var rS in state.rates){
            var rState = state.rates[rS];
            if(rState.fulfilled === false){
                for(var rD in reatesDefs){
                   var rDef = reatesDefs[rD];
                   if(rState.rate === rDef.id){
                       //level passing request scope (now static)
                       var scope = rState.scope.resource + ',' + rState.scope.operation.toLowerCase() + ',' + rState.scope.level;
                       //over tiene que modificarse
                       var metric = null;
                       for(var m in state.metrics){
                          var aux = state.metrics[m];
                          if(aux.metric == Object.keys(rDef.over)[0] && aux.scope.resource == rState.scope.resource
                              && aux.scope.operation == rState.scope.operation && aux.scope.level == rState.scope.level )
                            metric = aux;
                       }
                       //elavorate with period
                       var awaitTo = null;
                       if(rDef.of[scope].limits[0].period){
                          switch (rDef.of[scope].limits[0].period) {
                            case 'secondly':
                              awaitTo = new Date(new Date().getTime() + 1000);
                              break;
                            case 'minutely':
                              awaitTo = new Date(new Date().getTime() + (60 * 1000));
                              break;
                            case 'hourly':
                              awaitTo = new Date(new Date().getTime() + (60 * 60 * 1000));
                              break;
                            case 'daily':
                              awaitTo = new Date(new Date().getTime() + (24 * 60 * 60 * 1000));
                              break;
                            case 'monthly':
                              awaitTo = new Date(new Date().getTime() + (30 * 24 * 60 * 60 * 1000));
                              break;
                            case 'yearly':
                              awaitTo = new Date(new Date().getTime() + (12 * 30 * 24 * 60 * 60 * 1000));
                              break;
                            default:
                              break;
                          }
                       }
                       this.rates.push(new limit(
                            rState.scope.resource,
                            rState.scope.operation,
                            metric.metric,
                            rDef.of[scope].limits[0].max, metric.value, awaitTo ? iso8601.fromDate(awaitTo) : null
                          )
                      );
                  }
                }
            }
        }
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

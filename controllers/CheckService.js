'use strict';
var request = require('request');
var config = require('../config');

exports.checkPOST = function(args, res, next) {
    /**
     * parameters expected in the args:
    * requestInfo (RequestInfo)
    **/
    if(args.requestInfo.value){
        var requestInfo = args.requestInfo.value;
        getStateByAgreement(requestInfo, (body) => {

            res.json( new status( true, [ new limit('/pets', 'GET', 'requests', 100, 50, null) ], [], { filteringType: "none",xmlFormat: false },
                      [ "responseTime","animalType","resourceInstances" ]
            ));

        }, (error, response, body) => {

            if(!error && response.statusCode == 404){
                res.json( new status( false, [], [], {}, [], 'You do not have sla'));
            }else{
                res.json( new status( false, [], [], {}, [], error.toString()));
            }

        });
    }else{
        res.status(400);
        res.json(new error(400, "Bad request, you need to pass requestInfo in the body"));
    }

}


function getStateByAgreement(requestInfo, successCb, errorCb){
    var uri = config.services.registry.uri + config.services.registry.apiVersion + "/states/agreements/" + requestInfo.sla;

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

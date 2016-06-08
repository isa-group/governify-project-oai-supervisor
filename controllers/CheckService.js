'use strict';

exports.checkPOST = function(args, res, next) {
    /**
     * parameters expected in the args:
    * requestInfo (RequestInfo)
    **/
    if(args.requestInfo.value){
        var requestInfo = args.requestInfo.value;
        res.json( new status(
                      true,
                      [
                          new limit('/pets', 'GET', 'requests', 100, 50, null)
                      ],
                      [],
                      {
                          filteringType: "none",
                          xmlFormat: false
                      },
                      ["responseTime","animalType","resourceInstances"]
                ));
    }else{
        res.status(400);
        res.json(new error(400, "Bad request, you need to pass requestInfo in the body"));
    }

}

function error (code, message){
    this.code = code;
    this.message = message;
}

function status(accept, quotas, rates, configuration, requestedMetrics ){
    this.accept = accept;
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

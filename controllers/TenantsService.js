'use strict';
var request = require('request');
var config = require('../config');

exports.tenantsGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * apikey (String)
  * account (String)
  **/
    if(args.apikey.value){
        var apikey = args.apikey.value;
        resolveTenantByApikey(apikey, (err, body) => {
            if(!err)
                res.json(body);
            else {
                res.status(500);
                res.json(new error(500, err.toString()));
            }
        });
    }else {
        if(args.account.value){
            var account = args.account.value;
            resolveTenantByAccount(account, (err, body) => {
                if(!err)
                    res.json(body);
                else {
                    res.status(500);
                    res.json(new error(500, err.toString()));
                }
            });
        }else{
            res.status(400);
            res.json(new error(400, "Bad request, you need to pass apikey or account in a query parameter"));
        }
    }

}

function resolveTenantByAccount(account, callback){
    getTenant("account", account, (err, body) => {
        callback(err, body);
    });
}

function resolveTenantByApikey(apikey, callback){
    getTenant("apikey", apikey, (err, body) => {
        callback(err, body);
    });
}

function getTenant(keyName, keyValue, callback){
    var url = config.services.tenants.uri + config.services.tenants.apiVersion + "/namespaces/oai/tenants";
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

function error (code, message){
    this.code = code;
    this.message = message;
}

function tenant(sla, scope, requestedPayload){
    this.sla = sla,
    this.scope = scope;
    this.requestedPayload = requestedPayload;
}

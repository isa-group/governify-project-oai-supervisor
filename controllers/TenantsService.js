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
            if(!err){
                console.log(body);
                if(body.agreement){
                    res.json(new tenant(body.agreement, body.scope));
                }else{
                    res.json(body);
                }
            } else {
                res.status(500);
                res.json(new error(500, err.toString()));
            }
        });
    }else {
        if(args.account.value){
            var account = args.account.value;
            resolveTenantByAccount(account, (err, body) => {
                if(!err)
                    if(body.agreement){
                        res.json(new tenant(body.agreement, body.scope));
                    }else{
                        res.json(body);
                    }
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

exports.tenantsPOST = function(args, res, next) {
  /**
   * parameters expected in the args:
  * tenant (newTenant)
  **/
    if(args.tenant.value){
        var newTenant = args.tenant.value
        var newTenant = new governifyTenant(newTenant.sla, newTenant.scope);

        var r = request.post({
          url: config.services.tenants.uri + config.services.tenants.apiVersion + "/namespaces/oai/tenants",
          body: newTenant,
          json: true
        }, (err, response, body) => {
            if(!err && response.statusCode == 200){
                res.end();
            }else{
                res.status(response.statusCode);
                res.json(new error(response.statusCode, body));
            }
        });
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

function governifyTenant(sla, scope){
    this.agreement = sla,
    this.scope = scope;
}

function tenant (sla, scope){
  this.sla = sla,
  this.scope = scope;
  this.requestedPayload = {};
}

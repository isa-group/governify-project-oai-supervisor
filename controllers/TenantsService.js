'use strict';

exports.tenantsGET = function(args, res, next) {
  /**
   * parameters expected in the args:
  * apikey (String)
  * account (String)
  **/
    if(args.apikey.value){
        var apikey = args.apikey.value;
        res.json(resolveTenantByApikey(apikey));
    }else {
        if(args.account.value){
            var account = args.account.value;
            res.json(resolveTenantByAccount(account));
        }else{
            res.status(400);
            res.json(new error(400, "Bad request, you need to pass apikey or account in a query parameter"));
        }
    }

}

function resolveTenantByAccount(account){
    return new tenant("petstore_pro",{ tenant: 'tenant1', 'account': account }, { reportType: '/type' });
}

function resolveTenantByApikey(apikey){
    return new tenant("petstore_pro", { tenant: 'tenant1',  account: 'account1@tenant1.com' }, { reportType: '/type' });
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

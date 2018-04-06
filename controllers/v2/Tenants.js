'use strict';

var url = require('url');


var Tenants = require('./TenantsService');


module.exports.tenantsGET = function tenantsGET(req, res, next) {
  Tenants.tenantsGET(req.swagger.params, res, next);
};

module.exports.tenantsPOST = function tenantsPOST(req, res, next) {
  Tenants.tenantsPOST(req.swagger.params, res, next);
};

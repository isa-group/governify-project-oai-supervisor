'use strict';

var url = require('url');


var Check = require('./CheckService');


module.exports.checkPOST = function checkPOST(req, res, next) {
  Check.checkPOST(req.swagger.params, res, next);
};

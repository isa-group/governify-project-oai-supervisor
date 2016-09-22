'use strict';

var url = require('url');

var Slas = require('./SlasService');


module.exports.slasPOST = function slasPOST (req, res, next) {
  Slas.slasPOST(req.swagger.params, res, next);
};

module.exports.slasGET = function slasGET (req, res, next) {
  Slas.slasGET(req.swagger.params, res, next);
};

module.exports.slasPUT = function slasPUT (req, res, next) {
  Slas.slasPUT(req.swagger.params, res, next);
};

module.exports.slasDELETE = function slasDELETE (req, res, next) {
  Slas.slasDELETE(req.swagger.params, res, next);
};

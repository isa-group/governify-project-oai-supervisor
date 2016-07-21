'use strict';
var request = require('request');
var config = require('../config');
var logger = require('../config').logger;
var manager = require('governify-agreement-manager');
var fs = require('fs');
var jsyaml = require('js-yaml');

exports.slasPOST = function(args, res, next) {

    var sla = args.sla.value;
    var translators = manager.translators.sla4oai;
    logger.slaCtl("New request to create agreement");

    logger.slaCtl("Converting oai model to governify model...");
    translators.convertObject(sla, (data)=>{

        var slaObject = jsyaml.safeLoad(data);
        logger.slaCtl("Model has been converted");

        var url = config.services.registry.uri + config.services.registry.apiVersion + "/agreements";
        logger.slaCtl("Creating agreements on registry ( url = %s )", url);
        request.post({uri: url, json: true, body: slaObject}, (err, response, body) => {
            if(!err){
                if( response.statusCode === 201 ||  response.statusCode === 200 ){
                    logger.slaCtl("Agreement has been created successfuly.");
                    //res.status(201).json(new error(201, slaObject));
                    res.status(201).end();
                }else{
                    logger.slaCtl("Error from registry: " +  JSON.stringify(body, null, 2));
                    res.status(body.code).json(new error(body.code, body.message));
                }
            }else{
                logger.slaCtl("Unexpected Error: " +  JSON.stringify(err, null, 2));
                res.status(500).json(new error(500, err));
            }
        });

    }, (err) => {
        logger.slaCtl("Unexpected Error: " +  JSON.stringify(err, null, 2));
        res.status(500).json(new error(500, "There was problem with document validation please check if it is correct"));
    });

};

exports.slasGET = function(args, res, next) {

    logger.slaCtl("New request to get a list of agreement ids");

    var url = config.services.registry.uri + config.services.registry.apiVersion + "/agreements";
    logger.slaCtl("Getting agreements from registry ( url = %s )", url);
    request.get({uri: url, json: true}, (err, response, body) => {
        if(!err){
            if( response.statusCode === 200 ){
                logger.slaCtl("Agreements has been retrived successfuly.");

                res.status(200).json( body.map((element)=>{
                    return element.id;
                }));

            }else{
                logger.slaCtl("Error from registry: " +  JSON.stringify(body, null, 2));
                res.status(500).json(new error(500, body));
            }
        }else{
            logger.slaCtl("Unexpected Error: " +  JSON.stringify(err, null, 2));
            res.status(500).json(new error(500, err));
        }
    });

};

exports.slasPUT = function(args, res, next) {
    var sla = args.sla.value;
    var id = args.slaId.value;
    var translators = manager.translators.sla4oai;
    logger.slaCtl("New request to create agreement");

    logger.slaCtl("Converting oai model to governify model...");
    translators.convertObject(sla, (data)=>{

        var slaObject = jsyaml.safeLoad(data);
        logger.slaCtl("Model has been converted");

        var url = config.services.registry.uri + config.services.registry.apiVersion + "/agreements/" + id ;
        logger.slaCtl("Updating agreements on registry ( url = %s )", url);
        request.put({uri: url, json: true, body: slaObject}, (err, response, body) => {
            if(!err){
                if( response.statusCode === 201 ||  response.statusCode === 200 ){
                    logger.slaCtl("Agreement has been updated successfuly.");
                    //res.status(201).json(new error(201, slaObject));
                    res.status(200).end();
                }else{
                    logger.slaCtl("Error from registry: " +  JSON.stringify(body, null, 2));
                    res.status(body.code).json(new error(body.code, body.message));
                }
            }else{
                logger.slaCtl("Unexpected Error: " +  JSON.stringify(err, null, 2));
                res.status(500).json(new error(500, err));
            }
        });

    }, (err) => {
        logger.slaCtl("Unexpected Error: " +  JSON.stringify(err, null, 2));
        res.status(500).json(new error(500, "There was problem with document validation please check if it is correct"));
    });
};

exports.slasDELETE = function(args, res, next) {
    var slaId = args.slaId.value;

    logger.slaCtl("New request to delete an agreement with id = %s", slaId);

    var url = config.services.registry.uri + config.services.registry.apiVersion + "/agreements/" + slaId;
    logger.slaCtl("Deleting agreements from registry ( url = %s )", url);

    request.delete({uri: url, json: true}, (err, response, body) => {
        if(!err){
            if( response.statusCode === 200 ){
                logger.slaCtl("Agreements has been delete successfuly.");

                res.status(200).end();

            }else{
                logger.slaCtl("Error from registry: " +  JSON.stringify(body, null, 2));
                res.status(500).json(new error(500, body));
            }
        }else{
            logger.slaCtl("Unexpected Error: " +  JSON.stringify(err, null, 2));
            res.status(500).json(new error(500, err));
        }
    });
};


function error (code, message){
    this.code = code;
    this.message = message;
}

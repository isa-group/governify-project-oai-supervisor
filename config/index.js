'use strict'
var jsyaml = require('js-yaml');
var fs = require('fs');

var configString = fs.readFileSync('./config/config.yaml', 'utf8');
module.exports = jsyaml.safeLoad(configString)[process.env.NODE_ENV ? process.env.NODE_ENV : 'development'];

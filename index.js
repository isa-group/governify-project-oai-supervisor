'use strict';


var express = require('express');
var swaggerTools = require('swagger-tools');
var jsyaml = require('js-yaml');
var fs = require('fs');
var bodyParser = require('body-parser');
var cors = require('cors');
var config = require('./config');
var logger = config.logger;

var serverPort = (process.env.PORT || config.port);
var app = express();

app.use(bodyParser.json());
app.use(cors());
// swaggerRouter configuration
var optionsV1 = {
	swaggerUi: '/swagger/v1.json',
	controllers: './controllers/v1',
	useStubs: process.env.NODE_ENV === 'development' ? true : false // Conditionally turn on stubs (mock mode)
};

var optionsV2 = {
	swaggerUi: '/swagger/v2.json',
	controllers: './controllers/v2',
	useStubs: process.env.NODE_ENV === 'development' ? true : false // Conditionally turn on stubs (mock mode)
};

// The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
var specV1 = fs.readFileSync('./api/swagger/v1.yaml', 'utf8');
var swaggerDocV1 = jsyaml.safeLoad(specV1);

// The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
var specV2 = fs.readFileSync('./api/swagger/v2.yaml', 'utf8');
var swaggerDocV2 = jsyaml.safeLoad(specV2);

// Initialize the Swagger middleware
swaggerTools.initializeMiddleware(swaggerDocV1, function (middleware) {
	// Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
	app.use(middleware.swaggerMetadata());

	// Validate Swagger requests
	app.use(middleware.swaggerValidator());

	// Route validated requests to appropriate controller
	app.use(middleware.swaggerRouter(optionsV1));

	// Serve the Swagger documents and Swagger UI
	app.use(middleware.swaggerUi({
		apiDocs: swaggerDocV1.basePath + '/api-docs',
		swaggerUi: swaggerDocV1.basePath + '/docs'
	}));

	//app.use("/agreements", express.static("agreements"));
	swaggerTools.initializeMiddleware(swaggerDocV2, function (middleware) {
			// Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
			app.use(middleware.swaggerMetadata());

			// Validate Swagger requests
			app.use(middleware.swaggerValidator());

			// Route validated requests to appropriate controller
			app.use(middleware.swaggerRouter(optionsV2));

			// Serve the Swagger documents and Swagger UI
			app.use(middleware.swaggerUi({
				apiDocs: swaggerDocV2.basePath + '/api-docs',
				swaggerUi: swaggerDocV2.basePath + '/docs'
			}));
			// Start the server
			app.listen(serverPort, function () {
				logger.info('Your V1 server is listening  on port %d (http://localhost:%d/api/v1)', serverPort, serverPort);
				logger.info('Your V2 server is listening  on port %d (http://localhost:%d/api/v2)', serverPort, serverPort);
				logger.info('Swagger-ui is available on http://localhost:%d/api/v1/docs', serverPort);
				logger.info('Swagger-ui is available on http://localhost:%d/api/v2/docs', serverPort);
			});
	});
});

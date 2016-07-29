# OAI Supervisor

This project is an implementation of Basic SLA Management [SLA Check](https://github.com/isa-group/SLA4OAI-Specification/blob/master/operationalServices.md#42-sla-check) service.
You can find a running instance [here](http://supervisor.oai.governify.io/api/v1/docs).

This component depends on two others components:

1. Registry,  [read more]().
2. Tenants, [read more]().

You can configure the endpoints of these component on `./config/config.yaml`

## Running Local

Download this repository, configure components and execute these commands:

```javascript

npm install

npm start

```
## Running Docker

Run the components which supervisor depends on and execute this command:

```javascript

docker run -d --name supervisor-container -e NODE_ENV=production --link registry-container:registry --link tenants-container:tenants -p 5000:80 isagroup/governify-project-oai-supervisor
```

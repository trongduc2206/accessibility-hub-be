# Run local evaluation with Docker

Current Docker image: `accessibility-hub-runner:2.0`

Run the below command line:

```docker
docker run --rm -p <local_port>:<container_port> --shm-size=1g -e TARGET_URL=<web_url> -e SERVICE_ID=<service_id> -e TOOL=<axe_or_pa11y> -e AXE_MODE=<all or default> accessibility-hub-runner:2.0
```

The `TOOL` is `axe` by default

The `AXE_MODE` is only needed if `TOOL` is `axe` and has the default value as `default` which will get the list of enabled ID from `accessibility hub` to run.


An example for the evaluation of a web service run in `localhost:3000`:
```docker
docker run --rm -p 3000:3000 --shm-size=1g -e TARGET_URL="http://localhost:3000" -e SERVICE_ID="testservice17143" -e TOOL=axe -e AXE_MODE=all accessibility-hub-runner:2.0
```
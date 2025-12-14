#!/bin/bash

set -e


GITLAB_URL="https://gitlab.akhcheck.ru"
REGISTRATION_TOKEN="glrt-L5oXPeHzsgnzMEexEBLt"

docker stop gitlab-runner 2>/dev/null || true
docker rm gitlab-runner 2>/dev/null || true

docker run -d \
  --name gitlab-runner \
  --restart always \
  -v /var/run/docker.sock:/var/run/docker.sock \
  gitlab/gitlab-runner:alpine3.19

sleep 10

docker exec gitlab-runner apk add --no-cache docker nodejs npm postgresql-client

docker exec gitlab-runner gitlab-runner register \
  --non-interactive \
  --url "$GITLAB_URL" \
  --registration-token "$REGISTRATION_TOKEN" \
  --executor "docker" \
  --docker-image "node:18-alpine" \
  --docker-volumes "/var/run/docker.sock:/var/run/docker.sock" \
  --description "Skychart Quick Runner" \
  --tag-list "docker,node,skychart" \
  --run-untagged="true" \
  --locked="false"

echo "Runner ready!"
echo "Check status: docker logs gitlab-runner"
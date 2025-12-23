.PHONY: clean clean-build clean-pyc clean-test coverage dist docs help install lint lint/flake8

.DEFAULT_GOAL := help

define BROWSER_PYSCRIPT
import os, webbrowser, sys

from urllib.request import pathname2url

webbrowser.open("file://" + pathname2url(os.path.abspath(sys.argv[1])))
endef
export BROWSER_PYSCRIPT

define PRINT_HELP_PYSCRIPT
import re, sys

for line in sys.stdin:
	match = re.match(r'^([a-zA-Z_-]+):.*?## (.*)$$', line)
	if match:
		target, help = match.groups()
		print("%-20s %s" % (target, help))
endef
export PRINT_HELP_PYSCRIPT

BROWSER := python3 -c "$$BROWSER_PYSCRIPT"
PYTHON_PATH = "${PYTHONPATH}:${PWD}/src"


google_project := "solvely-test"
google_region := "us"
google_artifact_registry := "${google_region}-docker.pkg.dev/${google_project}/gcr.io"
google_artifact_registry_image := "${google_artifact_registry}/ai-testcase-agent-nginx-server:latest"




help:
	@python3 -c "$$PRINT_HELP_PYSCRIPT" < $(MAKEFILE_LIST)

build_docker: ## 构建docker镜像
	 docker build --platform linux/amd64  -t ${google_artifact_registry_image} --push  .


push_docker:   ## 推送docker镜像
	 docker push ${google_artifact_registry_image}

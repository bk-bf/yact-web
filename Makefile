SHELL := /bin/bash

.PHONY: dev-web lint test ci

dev-web:
	npm run dev:web

lint:
	npm run ci:lint

test:
	npm run ci:test

ci: lint test

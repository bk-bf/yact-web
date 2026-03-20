#!/usr/bin/env bash
set -euo pipefail

npm run ci:lint
npm run ci:test

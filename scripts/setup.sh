#!/usr/bin/env sh
set -e

mkdir -p extension

if [ ! -f extension/config.js ]; then
  cp extension/config.example.js extension/config.js
  echo "Created extension/config.js from template."
else
  echo "extension/config.js already exists."
fi

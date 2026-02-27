#!/usr/bin/env sh
set -e

mkdir -p extension dashboard

if [ ! -f extension/config.js ]; then
  cp extension/config.example.js extension/config.js
  echo "Created extension/config.js from template."
else
  echo "extension/config.js already exists."
fi

if [ ! -f dashboard/config.js ]; then
  cp dashboard/config.example.js dashboard/config.js
  echo "Created dashboard/config.js from template."
else
  echo "dashboard/config.js already exists."
fi

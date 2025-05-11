#!/bin/sh

# Read the target URL from the first argument
TARGET_URL=$1

if [ -z "$TARGET_URL" ]; then
  echo "Error: No target URL provided."
  exit 1
fi

# Run pa11y with the provided URL
echo "Running pa11y on $TARGET_URL..."
pa11y "$TARGET_URL" --no-sandbox

# Exit with the status of the pa11y command
exit $?
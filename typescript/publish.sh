#!/bin/bash
set -e

# Check if NODE_AUTH_TOKEN is set
if [[ -z "${NODE_AUTH_TOKEN}" ]]; then
  echo "NODE_AUTH_TOKEN is not set. Please set the environment variable and try again."
  exit 1
fi

# Navigate to the "packages" folder
cd packages

# Loop over each package in the "packages" folder
for package in */; do
  # Move into the package directory
  cd "$package"

  # Publish the package using yarn publish
  yarn publish --non-interactive

  # Move back to the parent directory
  cd ..
done
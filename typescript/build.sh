#!/bin/bash
set -e

# Check if jq is installed
if ! command -v jq &>/dev/null; then
  echo "Error: jq is not installed. Please install it and try again."
  exit 1
fi

# This script is a workaround that allows us to build a TypeScript monorepo
# with tsup. The build process consists of two steps: generating the type
# declarations using tsc and then bundling the project with tsup (with dts
# generation disabled). After building, the script also packs the npm packages.

# Function: build
# Desc: Builds a TypeScript package in the specified directory.
# Args:
#   $1: The directory of the package to build.
function build {
  # Change to the specified package directory.
  cd "$1"

  echo "Building $1..."

  # Generate type declaration files (.d.ts) using the TypeScript compiler.
  npx tsc --declarationDir temp --declaration --emitDeclarationOnly

  # Bundle the project using tsup.
  npx tsup

  # Build index.d.ts and move it to the dist folder.
  npx tsup --entry.index ./temp/index.d.ts --dtsOnly

  # Remove the temporary directory used for type declaration generation.
  rm -rf temp

  # Return to the previous working directory.
  cd ~-
}

# Function: pack
# Desc: Packs a TypeScript package in the specified directory.
# Args:
#   $1: The directory of the package to pack.
function pack {
  # Change to the specified package directory.
  cd "$1"

  # Pack the npm package.
  npm pack

  # Return to the previous working directory.
  cd ~-
}

yarn lint:check
yarn style:check

# Read the version from the .env file
VERSION=$(grep '^VERSION=' ../.env | cut -d '=' -f2)

if [ -z "$VERSION" ]; then
  echo "Error: VERSION not found in .env file"
  exit 1
fi

function update_package {
  PACKAGE_JSON=$1
  # Update the version of the package and the '@tempojs' scoped dependencies
  jq --arg ver "$VERSION" --arg depVer "^$VERSION" '.version = $ver | if .dependencies? then .dependencies |= with_entries(if .key | test("^@tempojs/") then .value = $depVer else . end) else . end' "$PACKAGE_JSON" >"$PACKAGE_JSON.tmp"

  mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"
}

# Update the version of the root package.json file
update_package "./package.json"

# Find all package.json files in the packages directory
PACKAGE_JSON_FILES=$(find packages -type f -name 'package.json')

# Loop through each package.json file and update the version and dependencies
for PACKAGE_JSON in $PACKAGE_JSON_FILES; do
  update_package "$PACKAGE_JSON"
done

COMMON_VERSION_FILE="./packages/common/src/version.ts"
echo "export const TempoVersion = '$VERSION';" > $COMMON_VERSION_FILE

echo "All package versions and '@tempojs' dependencies have been updated to $VERSION."

# Test

yarn vitest run

# Build and pack the 'common' package.
build ./packages/common
#pack ./packages/common

# Build and pack the 'client' package.
build ./packages/client
#pack ./packages/client

# Build and pack the 'server' package.
build ./packages/server
#pack ./packages/server

# Build and pack the 'cloudflare-worker-router' package.
build ./packages/cf-router

# Build and pack the 'node-http-router' package.
build ./packages/node-http

# Install package dependencies
yarn install

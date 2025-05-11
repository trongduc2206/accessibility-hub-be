#!/bin/sh

# Read the target URL from the first argument
TARGET_URL=$1
SERVICE_ID=$2
AXE_MODE=${3:-default} 

if [ -z "$TARGET_URL" ]; then
  echo "Error: No target URL provided."
  exit 1
fi

# Replace localhost with host.docker.internal
TARGET_URL=$(echo $TARGET_URL | sed 's/localhost/host.docker.internal/')

if [ "$AXE_MODE" = "all" ]; then
  echo "AXE_MODE is set to 'all'. Running Axe CLI without specific rules."
  AXE_OUTPUT=$(axe "$TARGET_URL" --chrome-options="headless,no-sandbox,disable-gpu,incognito" --exit)
  
  # Show the result of Axe CLI
  echo "$AXE_OUTPUT"

  ESCAPED_AXE_OUTPUT=$(echo "$AXE_OUTPUT" | jq -Rs .)

  # Send the output to the /extract-rule-ids endpoint
  RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"output\":$ESCAPED_AXE_OUTPUT, \"serviceId\":\"$SERVICE_ID\"}" https://accessibility-hub-be.onrender.com/extract-rule-ids)
  
  # Show the response from the /extract-rule-ids endpoint
  echo "Response from /extract-rule-ids endpoint:"
  echo "$RESPONSE"
else
  # Fetch rule IDs from the API
  echo "Fetching rule IDs..."
  RULE_IDS=$(curl -s "https://accessibility-hub-be.onrender.com/rules/$SERVICE_ID")
  echo $RULE_IDS

  if [ -z "$RULE_IDS" ]; then
    echo "No rule IDs retrieved. Exiting..."
    exit 1
  fi

  # Run Axe CLI with specified rules
  echo "Running Axe CLI on $TARGET_URL with rules: $RULE_IDS"
  axe "$TARGET_URL" --chrome-options="headless,no-sandbox,disable-gpu,incognito" --rules "$RULE_IDS" --verbose --exit
fi

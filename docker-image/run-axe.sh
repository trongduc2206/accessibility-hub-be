#!/bin/sh

# Read the target URL from the first argument

TARGET_URL=${TARGET_URL}
SERVICE_ID=${SERVICE_ID}
TOOL=${TOOL:-axe}          # Default TOOL to "axe" if not provided
AXE_MODE=${AXE_MODE:-default} 

# TARGET_URL=$1
# SERVICE_ID=$2
# TOOL=${3:-axe}
# AXE_MODE=${4:-default}

if [ -z "$TARGET_URL" ]; then
  echo "Error: No target URL provided."
  exit 1
fi

if [ -z "$SERVICE_ID" ]; then
  echo "Error: No service ID provided."
  exit 1
fi

# Replace localhost with host.docker.internal
TARGET_URL=$(echo $TARGET_URL | sed 's/localhost/host.docker.internal/')

if [ "$TOOL" = "pa11y" ]; then
  # Execute pa11y if the TOOL is set to "pa11y"
  echo "TOOL is set to 'pa11y'. Running Pa11y..."
  PA11Y_OUTPUT=$(pa11y "$TARGET_URL" --config /app/pa11y-config.json)

  # Show the result of Axe CLI
  echo "$PA11Y_OUTPUT"

  ESCAPED_PA11Y_OUTPUT=$(echo "$PA11Y_OUTPUT" | jq -Rs .)

  # Send the output to the /extract-rule-ids endpoint
  RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"output\":$ESCAPED_PA11Y_OUTPUT, \"serviceId\":\"$SERVICE_ID\"}" https://accessibility-hub-be.onrender.com/extract-rule-codes)
    
  # Show the response from the /extract-rule-ids endpoint
  echo "Response from /extract-rule-codes endpoint:"
  echo "$RESPONSE"
  exit $?
elif [ "$TOOL" = "axe" ]; then
  # Execute axe if the TOOL is set to "axe"
  if [ "$AXE_MODE" = "all" ]; then
    echo "AXE_MODE is set to 'all'. Running Axe CLI without specific rules."
    AXE_OUTPUT=$(axe "$TARGET_URL" --chrome-options="headless,no-sandbox,disable-gpu,incognito" --exit)
    
    # Show the result of Axe CLI
    echo "$AXE_OUTPUT"

    ESCAPED_AXE_OUTPUT=$(echo "$AXE_OUTPUT" | jq -Rs .)

    # Send the output to the /extract-rule-ids endpoint
    RESPONSE=$(curl -s --max-time 10  -X POST -H "Content-Type: application/json" -d "{\"output\":$ESCAPED_AXE_OUTPUT, \"serviceId\":\"$SERVICE_ID\"}" https://accessibility-hub-be.onrender.com/extract-rule-ids)
    
    # Check for errors
    if [ $? -ne 0 ]; then
      echo "Error: Failed to send request to /extract-rule-codes endpoint."
      exit 1
    fi

    # Send the output to the /axe-full-manual endpoint
    RESPONSE2=$(curl -s --max-time 10  -X POST -H "Content-Type: application/json" -d "{\"output\":$ESCAPED_AXE_OUTPUT, \"serviceId\":\"$SERVICE_ID\"}" https://accessibility-hub-be.onrender.com/axe-full-manual)

    # Check for errors
    if [ $? -ne 0 ]; then
      echo "Error: Failed to send request to /axe-full-manual endpoint."
      exit 1
    fi
    
    # Show the response from the /extract-rule-ids endpoint
    echo "Response from /extract-rule-ids endpoint:"
    echo "$RESPONSE"

    echo "Response from /axe-full-manual endpoint:"
    echo "$RESPONSE2"
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
    AXE_OUTPUT=$(axe "$TARGET_URL" --chrome-options="headless,no-sandbox,disable-gpu,incognito" --rules "$RULE_IDS" --verbose --exit)
    
    # Show the result of Axe CLI
    echo "$AXE_OUTPUT"
    ESCAPED_AXE_OUTPUT=$(echo "$AXE_OUTPUT" | jq -Rs .)

    # Send the output to the /extract-rule-ids endpoint
    RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"output\":$ESCAPED_AXE_OUTPUT, \"serviceId\":\"$SERVICE_ID\"}" https://accessibility-hub-be.onrender.com/extract-rule-ids)
    
    # Show the response from the /extract-rule-ids endpoint
    echo "Response from /extract-rule-ids endpoint:"
    echo "$RESPONSE"
  fi
else
  echo "Error: Invalid tool specified. Use 'axe' or 'pa11y'."
  exit 1
fi

#!/bin/bash
# Quick script to check accessibility tree from ios-simulator-mcp

DEVICE_UDID="9E18B379-A152-4A82-8C26-0C8BA160B2E5"

echo "Fetching accessibility tree for device: $DEVICE_UDID"
echo ""

# This requires ios-simulator-mcp to be running
# You can call it via npx or direct invocation
npx ios-simulator-mcp ui_describe_all --udid "$DEVICE_UDID" | jq .

echo ""
echo "If you see very few elements, your app needs accessibility labels!"

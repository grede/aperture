# Aperture Providers - Quick Start Guide

## What Are Providers?

Providers are pluggable automation backends that control iOS simulators. Aperture supports multiple providers, allowing you to choose the one that works best for your app.

## Available Providers

### 1. mobile-mcp (Default)
- **Backend**: WebDriverAgent
- **Best for**: React Native apps with accessibility labels
- **Install**: `npm install -g @mobilenext/mobile-mcp`
- **Config**: `endpoint: stdio://mcp-server-mobile`

**Pros:**
- ✅ Full WebDriverAgent feature set
- ✅ Unicode text input support
- ✅ Good React Native integration

**Cons:**
- ❌ Requires accessibility props (testID) on buttons
- ❌ No app lifecycle support
- ❌ Slower startup (WDA initialization)

### 2. ios-simulator-mcp ⭐ NEW
- **Backend**: iOS Debug Bridge (idb)
- **Best for**: Apps without accessibility props, native iOS apps
- **Install**: `npm install -g ios-simulator-mcp` or use npx
- **Config**: `endpoint: stdio://ios-simulator-mcp`

**Pros:**
- ✅ Native iOS tapping (better for React Native buttons without testID)
- ✅ Built-in app install/launch
- ✅ Faster connection
- ✅ No WebDriverAgent dependency

**Cons:**
- ⚠️ ASCII-only text input (emojis removed)
- ❌ No button press support

## Quick Switch

### Switch to ios-simulator-mcp

If mobile-mcp taps aren't working:

```bash
# Edit your config
nano aperture.config.yaml

# Change this line:
# mcp:
#   endpoint: stdio://mcp-server-mobile

# To this:
# mcp:
#   endpoint: stdio://ios-simulator-mcp

# Or use the pre-configured file
aperture run --config aperture.config.ios-simulator.yaml
```

### Switch back to mobile-mcp

If you need Unicode text input:

```bash
# Edit your config back to:
# mcp:
#   endpoint: stdio://mcp-server-mobile
```

## When to Use Each

| Situation | Use This Provider |
|-----------|-------------------|
| React Native FAB not responding to taps | **ios-simulator-mcp** |
| Unlabeled buttons (no testID prop) | **ios-simulator-mcp** |
| Need to type emoji or international text | **mobile-mcp** |
| App has good accessibility labels | **mobile-mcp** |
| Need fast startup | **ios-simulator-mcp** |
| Native iOS app | **ios-simulator-mcp** |

## Testing Both Providers

Run the same flow with both providers to compare:

```bash
# Test with mobile-mcp
aperture run

# Test with ios-simulator-mcp
aperture run --config aperture.config.ios-simulator.yaml
```

Compare the results:
- Which one successfully tapped your buttons?
- Which one completed the flow faster?
- Did both capture the same screenshots?

## Troubleshooting

### "Provider not found"

Install the provider:
```bash
# For mobile-mcp
npm install -g @mobilenext/mobile-mcp

# For ios-simulator-mcp
npm install -g ios-simulator-mcp
```

### Taps still not working?

Try these debugging steps:

1. **Check coordinates**: Enable verbose mode to see tap coordinates
   ```bash
   aperture run --verbose
   ```

2. **Try manual tap**: Manually click where the AI is trying to tap
   - If manual works but automated doesn't → provider issue
   - If manual doesn't work either → coordinate calculation issue

3. **Add testID props**: For React Native apps, this is the best solution:
   ```jsx
   <Pressable testID="create-button" onPress={onCreate}>
     <Text>+</Text>
   </Pressable>
   ```

4. **Switch providers**: Try the other provider to see if it works better

## Next Steps

- **Detailed Guide**: See `docs/IOS_SIMULATOR_MCP_GUIDE.md` for full ios-simulator-mcp documentation
- **Provider Architecture**: See `src/core/providers/README.md` for technical details
- **Add Custom Provider**: See `docs/PROVIDER_ABSTRACTION.md` for creating your own provider

## Quick Reference

```yaml
# mobile-mcp (WebDriverAgent)
mcp:
  endpoint: stdio://mcp-server-mobile

# ios-simulator-mcp (iOS Debug Bridge)
mcp:
  endpoint: stdio://ios-simulator-mcp

# Future: Appium
# mcp:
#   endpoint: http://localhost:4723

# Future: Maestro
# mcp:
#   endpoint: stdio://maestro
```

## Get Help

- GitHub Issues: https://github.com/your-repo/aperture/issues
- Provider Docs: `docs/IOS_SIMULATOR_MCP_GUIDE.md`
- MCP Protocol: https://modelcontextprotocol.io

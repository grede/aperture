# Using ios-simulator-mcp Provider

This guide explains how to use the `ios-simulator-mcp` provider as an alternative to `mobile-mcp` for iOS automation.

## Why Use ios-simulator-mcp?

The `ios-simulator-mcp` provider may solve automation issues that occur with `mobile-mcp`:

1. **Better React Native Support**: Uses native iOS accessibility APIs instead of WebDriverAgent, which may work better with React Native buttons that don't have `testID` props.

2. **App Lifecycle Support**: Built-in `install_app` and `launch_app` support (mobile-mcp requires DeviceManager fallback).

3. **Native Tapping**: Uses iOS Debug Bridge (idb) for coordinate-based tapping, avoiding WebDriverAgent's element interaction model.

4. **No WebDriverAgent**: Doesn't require WebDriverAgent installation or management.

## Installation

### Option 1: Global Install (Recommended)

```bash
npm install -g ios-simulator-mcp
```

### Option 2: Use npx (No Installation)

The provider will automatically use npx if you haven't installed it globally.

## Configuration

Update your `aperture.config.yaml`:

```yaml
# Before (mobile-mcp)
mcp:
  endpoint: stdio://mcp-server-mobile

# After (ios-simulator-mcp)
mcp:
  endpoint: stdio://ios-simulator-mcp
```

That's it! Aperture will automatically detect and use the new provider.

## Key Differences from mobile-mcp

### What Works the Same

- ✅ Accessibility tree inspection
- ✅ Coordinate-based tapping
- ✅ Typing text
- ✅ Scrolling and swiping
- ✅ Screenshots

### What's Different

| Feature | mobile-mcp | ios-simulator-mcp |
|---------|------------|-------------------|
| **App Install** | ❌ Via DeviceManager | ✅ Built-in |
| **App Launch** | ✅ Yes | ✅ Yes |
| **Text Input** | ✅ Unicode support | ⚠️ ASCII only |
| **Button Press** | ❌ Not supported | ❌ Not supported |
| **Tap Implementation** | AppleScript workaround | Native idb |
| **Backend** | WebDriverAgent | iOS Debug Bridge |

### Important Limitations

1. **Text Input**: ios-simulator-mcp only supports ASCII printable characters (0x20-0x7E). Non-ASCII characters will be automatically removed with a warning.

   ```yaml
   # This works fine
   - action: type
     text: "Hello World"

   # This will have emojis removed
   - action: type
     text: "Hello 👋"  # Becomes "Hello "
   ```

2. **Accessibility Tree Format**: The accessibility tree structure may differ from mobile-mcp. The provider handles this automatically, but verbose output may look different.

## Testing the Provider

### Quick Test

1. Update your config:
   ```yaml
   mcp:
     endpoint: stdio://ios-simulator-mcp
   ```

2. Run a simple flow:
   ```bash
   aperture run --locale en-US --device iphone
   ```

3. Check the output for:
   ```
   ✓ Provider connected (ios-simulator-mcp)
   ```

### Comparing Providers

To compare behavior between providers, create two config files:

**aperture.mobile-mcp.yaml**:
```yaml
app: ./build/MyApp.app
bundleId: com.example.myapp
flow: ./aperture-flow.yaml
# ... other config ...
mcp:
  endpoint: stdio://mcp-server-mobile
```

**aperture.ios-simulator.yaml**:
```yaml
app: ./build/MyApp.app
bundleId: com.example.myapp
flow: ./aperture-flow.yaml
# ... other config ...
mcp:
  endpoint: stdio://ios-simulator-mcp
```

Then test each:
```bash
# Test with mobile-mcp
aperture run --config aperture.mobile-mcp.yaml

# Test with ios-simulator-mcp
aperture run --config aperture.ios-simulator.yaml
```

## Troubleshooting

### "npx: command not found"

Install Node.js/npm, or install ios-simulator-mcp globally:
```bash
npm install -g ios-simulator-mcp
```

### "idb: command not found"

The ios-simulator-mcp package includes idb (iOS Debug Bridge). If you see this error, reinstall:
```bash
npm install -g ios-simulator-mcp --force
```

### Taps Not Working

If coordinate-based taps fail:

1. **Verify simulator is booted**: Check that the iOS Simulator is running
2. **Check coordinates**: Ensure coordinates are within screen bounds (e.g., 0-430 for iPhone 17 Pro Max)
3. **Try longer tap duration**: Modify the provider to use longer tap duration if needed

### Accessibility Tree Empty

If `ui_describe_all` returns empty data:

1. **Enable accessibility**: Settings → Accessibility → VoiceOver (doesn't need to be on, just accessible)
2. **Reboot simulator**: Sometimes accessibility needs a fresh start
3. **Check app permissions**: Ensure app has accessibility permissions

## Performance Comparison

Based on typical usage:

| Operation | mobile-mcp | ios-simulator-mcp |
|-----------|------------|-------------------|
| Connect | ~5-10s (WDA startup) | ~2-3s (idb ready) |
| Get Accessibility Tree | ~500ms | ~300ms |
| Tap | ~200ms (AppleScript) | ~150ms (native idb) |
| Screenshot | ~300ms | ~400ms (file I/O) |

**Note**: ios-simulator-mcp may be faster for initial connection but slightly slower for screenshots (file-based vs. base64).

## When to Use Each Provider

### Use mobile-mcp When:
- ✅ Working with React Native apps that have proper `testID` props
- ✅ Need WebDriverAgent feature set
- ✅ App has good accessibility labels
- ✅ Need Unicode text input (emoji, international characters)

### Use ios-simulator-mcp When:
- ✅ React Native buttons not responding to taps (missing `testID`)
- ✅ Need app lifecycle control (install, launch)
- ✅ Working with native iOS apps
- ✅ Faster startup time is important
- ✅ ASCII-only text input is sufficient

## Environment Variables

ios-simulator-mcp supports these environment variables:

```bash
# Filter out specific tools
export IOS_SIMULATOR_MCP_FILTERED_TOOLS="record_video,stop_recording"

# Custom output directory for screenshots/videos
export IOS_SIMULATOR_MCP_DEFAULT_OUTPUT_DIR="$HOME/aperture-output"

# Custom idb executable path
export IOS_SIMULATOR_MCP_IDB_PATH="/usr/local/bin/idb"

# Run aperture
aperture run
```

## Example: Switching Providers Mid-Development

You can easily switch providers if one isn't working well:

```bash
# Try with mobile-mcp first
aperture run

# If taps don't work, edit config to use ios-simulator-mcp
sed -i '' 's/mcp-server-mobile/ios-simulator-mcp/' aperture.config.yaml

# Try again
aperture run

# If text input needs Unicode, switch back
sed -i '' 's/ios-simulator-mcp/mcp-server-mobile/' aperture.config.yaml
```

## Future Enhancements

Potential improvements for ios-simulator-mcp provider:

- [ ] Add Unicode text input support via clipboard injection
- [ ] Implement element-based tapping via accessibility identifier
- [ ] Add button press support via simctl commands
- [ ] Optimize screenshot handling with in-memory buffers
- [ ] Add video recording support
- [ ] Improve accessibility tree parsing for complex UIs

## Contributing

Found an issue with the ios-simulator-mcp provider? Please report it with:

1. Provider version: Check `npm list -g ios-simulator-mcp`
2. Aperture version: Check `aperture --version`
3. Error logs: Run with `--verbose` flag
4. Steps to reproduce

GitHub Issues: https://github.com/joshuayoes/ios-simulator-mcp/issues

## References

- ios-simulator-mcp GitHub: https://github.com/joshuayoes/ios-simulator-mcp
- iOS Debug Bridge (idb): https://fbidb.io
- Provider Abstraction Docs: `src/core/providers/README.md`
- MCP Protocol: https://modelcontextprotocol.io

# AutoWabba

**Automatic Download Helper for Wabbajack**

AutoWabba automates the process of downloading mods from Nexus Mods when using Wabbajack mod lists by automatically clicking download buttons.

## Features

- **Automatic Download Clicking**: Automatically clicks download buttons on Nexus Mods pages
- **Error Recovery**: Detects and handles error pages and browser issues
- **Persistent Configuration**: Saves Wabbajack path for future use
- **Simple Interface**: Clean interface with just Start/Stop controls

## Requirements

- Windows 10/11
- Wabbajack mod manager
- Nexus Mods account (free)

## Installation

1. Download the latest release from the [Releases page](https://github.com/LucasHenriqueDiniz/AutoWabba/releases)
2. Extract the files to a folder
3. Run `AutoWabba.exe`

## Usage

1. **Select Wabbajack**: Click the edit icon next to the path to select your Wabbajack.exe
2. **Start Automation**: Click "Start" to launch Wabbajack with debug mode and begin automation
3. **Monitor Status**: Watch the status bar for current status
4. **Stop When Done**: Click "Stop" to end the automation

## How It Works

AutoWabba uses Chrome DevTools Protocol to connect to Wabbajack's embedded browser (WebView2) and automatically clicks download buttons when Wabbajack opens Nexus Mods pages.

## Error Handling

The tool includes robust error handling:

- **Download Stuck**: Automatically retries after 10 attempts
- **Error Pages**: Detects and waits for recovery
- **Browser Issues**: Monitors for multiple error pages and waits longer

## Development

To run from source:

```bash
npm install
npm start
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Author

Lucas Henrique Diniz

---

**Note**: This tool is designed to work with Wabbajack mod lists and Nexus Mods. Make sure you comply with Nexus Mods' terms of service and rate limits.

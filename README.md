# AutoWabba

![AutoWabba](./icon.png)

Automatically download mods from Nexus Mods when using Wabbajack mod lists. This tool makes the installation process of large modpacks completely automated by handling the download interaction.

**Note**: Currently only works with Nexus Mods downloads.

## Features

- Automatic detection of Nexus Mods download pages
- One-click setup for browser automation
- Elegant user interface
- Automatic click on download buttons
- Real-time status updates

## Prerequisites

- Windows 10/11
- [Wabbajack](https://www.wabbajack.org/) installed
- Microsoft Edge or Edge WebView2 Runtime
- Nexus Mods account (must be logged in within Wabbajack)

## Download

1. Download the latest release from [GitHub Releases](https://github.com/LucasHenriqueDiniz/AutoWabba/releases)
2. Extract the ZIP file to a location of your choice

## Usage

1. Make sure you're logged into your Nexus Mods account in Wabbajack
2. Run AutoWabba.exe
3. Click "Setup Browser" button
4. Open Wabbajack and start installing your mod list
5. Click "Start" in AutoWabba
6. Sit back and relax! The tool will automatically handle downloads

## How It Works

AutoWabba connects to Wabbajack's browser component and:

1. Monitors for Nexus Mods download pages
2. Automatically clicks the "Slow Download" button when detected
3. Waits for the download to complete before proceeding to the next download
4. Handles the entire queue of downloads for your modpack

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Browser not found" error | Make sure you clicked "Setup Browser" and Wabbajack is open |
| Downloads not being detected | Try restarting both AutoWabba and Wabbajack |
| Button clicks not working | Make sure you're logged into your Nexus Mods account |

## Building from Source

If you prefer to build the application yourself:

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm start` to start in development mode
4. Run `npm run build` to create a portable executable

## License

MIT License - See [LICENSE](LICENSE) file for details

## Author

Created by [Lucas Henrique Diniz](https://github.com/LucasHenriqueDiniz)

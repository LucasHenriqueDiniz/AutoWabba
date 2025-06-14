/**
 * AutoWabba - Automatic Download Helper for Wabbajack
 *
 * This application automates the process of downloading mods from Nexus Mods
 * when using Wabbajack mod lists by automatically clicking download buttons.
 *
 * @author Lucas Henrique Diniz
 * @license MIT
 */

const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const { checkBrowserAvailability, findTargetPage } = require("./src/browser");
const { performClick } = require("./src/downloader");
const { chromium } = require("playwright");

// Application state
let mainWindow;
let isRunning = false;
let stopRequested = false;

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 540,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    frame: false,
    resizable: false,
    transparent: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    backgroundColor: "#242424",
  });
  mainWindow.loadFile("src/interface.html");

  // Allow opening external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(() => {
  createWindow();

  // Check if Wabbajack is available at startup
  setTimeout(async () => {
    try {
      const pages = await checkBrowserAvailability();
      if (!pages) {
        mainWindow.webContents.send("log-message", "Browser not found. Setup the browser first.");
        mainWindow.webContents.send("browser-status", "unavailable");
      } else {
        mainWindow.webContents.send("log-message", "Browser found. Ready to start automation.");
        mainWindow.webContents.send("browser-status", "available");
      }
    } catch (error) {
      mainWindow.webContents.send("log-message", `Error checking browser: ${error.message}`);
      mainWindow.webContents.send("browser-status", "error");
    }
  }, 1000);
});

// Setup Edge in debugging mode
ipcMain.on("setup-browser", (event) => {
  exec("set WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222", (error) => {
    if (error) {
      event.reply("log-message", `Error setting up browser: ${error.message}`);
      return;
    }
    event.reply("log-message", "Edge configured in debugging mode (port 9222)");
    event.reply("setup-complete");
  });
});

// Start the automation process
ipcMain.on("start-automation", async (event) => {
  if (isRunning) {
    event.reply("log-message", "Automation is already running");
    return;
  }
  isRunning = true;
  stopRequested = false;
  event.reply("status-update", "running");
  event.reply("log-message", "Starting download automation...");

  let lastClickedUrl = null;
  const COOLDOWN_TIME = 6000;
  while (isRunning && !stopRequested) {
    try {
      const pages = await checkBrowserAvailability();
      // Enviar status do navegador para atualizar estado dos botões
      if (!pages) {
        event.reply("browser-status", "unavailable");
      } else {
        event.reply("browser-status", "available");
      }
      if (!pages) {
        event.reply("log-message", "Browser not found. Make sure Wabbajack is open.");
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      const targetPage = await findTargetPage(pages);

      if (targetPage) {
        if (lastClickedUrl === targetPage.url) {
          event.reply("log-message", "Download still in progress... Waiting for completion");
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        event.reply("log-message", "Download page found! Starting download...");
        const browser = await chromium.connectOverCDP("http://localhost:9222");
        const clickResult = await performClick(browser, targetPage);

        if (clickResult) {
          lastClickedUrl = clickResult;
          event.reply("log-message", `Download started! Waiting ${COOLDOWN_TIME / 1000}s...`);
          await browser.close();
          await new Promise((r) => setTimeout(r, COOLDOWN_TIME));
        } else {
          event.reply("log-message", "Failed to click download button. Trying again...");
          await browser.close();
          await new Promise((r) => setTimeout(r, 2000));
        }
      } else {
        if (lastClickedUrl) {
          const isStillOpen = pages.some((p) => p.url === lastClickedUrl);
          if (isStillOpen) {
            event.reply("log-message", "Download still in progress... Waiting for completion");
          } else {
            lastClickedUrl = null;
            event.reply("log-message", "Waiting for new download page...");
          }
        } else {
          event.reply("log-message", "Waiting for download page...");
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch (error) {
      event.reply("log-message", `Error: ${error.message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  isRunning = false;
  event.reply("status-update", "stopped");
  event.reply("log-message", "Automation stopped");
});

// Stop the automation
ipcMain.on("stop-automation", (event) => {
  if (!isRunning) {
    event.reply("log-message", "Automation is not running");
    return;
  }

  stopRequested = true;
  event.reply("log-message", "Request to stop automation received");
});

// Custom window event handling
ipcMain.on("minimize-window", () => {
  mainWindow.minimize();
});

ipcMain.on("close-window", () => {
  app.quit();
});

ipcMain.on("open-github", () => {
  shell.openExternal("https://github.com/LucasHenriqueDiniz/AutoWabba");
});

// Check browser availability when requested by renderer
ipcMain.on("check-browser", async (event) => {
  try {
    const pages = await checkBrowserAvailability();
    if (!pages) {
      event.reply("log-message", "Browser not found. Please set up the browser first.");
      event.reply("browser-status", "unavailable");
    } else {
      event.reply("log-message", "Browser found. Ready to start automation.");
      event.reply("browser-status", "available");
    }
  } catch (error) {
    event.reply("log-message", `Error checking browser: ${error.message}`);
    event.reply("browser-status", "error");
  }
});

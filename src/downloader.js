const { chromium } = require("playwright");

async function performClick(browser, targetPage) {
  try {
    const contexts = browser.contexts();
    const pages = contexts[0].pages();
    const page = pages.find((p) => p.url() === targetPage.url);

    if (!page) {
      throw new Error("Page not found");
    }

    await page.waitForSelector("button#slowDownloadButton", { timeout: 10000 });
    await page.evaluate(() => document.querySelector("button#slowDownloadButton")?.click());
    console.log("Button clicked!");
    return targetPage.url;
  } catch (error) {
    console.error("Error clicking:", error.message);
    return null;
  }
}

module.exports = {
  performClick,
};

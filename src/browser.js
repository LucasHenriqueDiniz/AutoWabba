const http = require("http");

async function checkBrowserAvailability() {
  return new Promise((resolve) => {
    http
      .get("http://localhost:9222/json/list", (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const pages = JSON.parse(data);
            resolve(pages);
          } catch (e) {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

async function findTargetPage(pages) {
  return pages?.find((page) => page.type === "page" && page.url.includes("nexusmods.com") && page.url.includes("tab=files"));
}

module.exports = {
  checkBrowserAvailability,
  findTargetPage,
};

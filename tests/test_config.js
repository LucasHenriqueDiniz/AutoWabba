/**
 * Test Configuration Path
 *
 * This script tests where the configuration file is being saved
 */

const { getWabbajackPath, saveWabbajackPath } = require("./src/wabbajack");
const path = require("path");

async function testConfig() {
  console.log("=== CONFIGURATION PATH TEST ===");

  // Test 1: Check current paths
  console.log("1. Current paths:");
  console.log(`   Process execPath: ${process.execPath}`);
  console.log(`   Process cwd: ${process.cwd()}`);
  console.log(`   __dirname: ${__dirname}`);

  // Test 2: Try to load existing config
  console.log("\n2. Loading existing config:");
  const existingPath = await getWabbajackPath();
  console.log(`   Existing path: ${existingPath || "None"}`);

  // Test 3: Save a test config
  console.log("\n3. Saving test config:");
  const testPath = "C:\\Test\\Wabbajack.exe";
  saveWabbajackPath(testPath);

  // Test 4: Load the test config
  console.log("\n4. Loading test config:");
  const loadedPath = await getWabbajackPath();
  console.log(`   Loaded path: ${loadedPath || "None"}`);

  console.log("\n✅ Configuration test completed!");
}

testConfig().catch(console.error);

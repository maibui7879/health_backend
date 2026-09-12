const { execSync } = require("child_process");

console.log("");
console.log("========================================");
console.log("Linting code...");
console.log("========================================");

try {
  execSync('npx eslint "{src,apps,libs,test}/**/*.ts" --fix', { stdio: "inherit" });

  console.log("");
  console.log("✓ Lint completed successfully!");
} catch (error) {
  console.error("");
  console.error("✗ Lint failed!");
  process.exit(1);
}

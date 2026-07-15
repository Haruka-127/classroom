const { build } = require("esbuild");
const glob = require("glob");
const fs = require("node:fs");
const archiver = require("archiver");
const entryPoints = glob.sync("./src/**/*.ts");

const config = {
  entryPoints,
  outdir: "./dist",
  platform: "node",
  minify: true,
  bundle: true,
};

(async () => {
  try {
    await build({ ...config });

    // images folder copy
    fs.mkdirSync("./dist/images", { recursive: true });
    const images = fs.readdirSync("./images");
    for (const image of images) {
      fs.copyFileSync(`./images/${image}`, `./dist/images/${image}`);
    }

    fs.copyFileSync("./manifest.json", "./dist/manifest.json");

    fs.mkdirSync("./dist/firefox", { recursive: true });

    // Copy manifest.json to firefox directory
    fs.copyFileSync("./manifest.json", "./dist/firefox/manifest.json");

    // Modify the copied manifest.json
    const data = fs.readFileSync("./dist/firefox/manifest.json", "utf8");
    const manifest = JSON.parse(data);
    manifest.browser_specific_settings = {
      gecko: {
        id: "minagishl@icloud.com",
      },
    };
    manifest.background = {
      scripts: ["background.js"],
    };
    // Remove the run_at key
    const { run_at, ...contentScript } = manifest.content_scripts[0];
    manifest.content_scripts[0] = contentScript;
    fs.writeFileSync(
      "./dist/firefox/manifest.json",
      JSON.stringify(manifest, null, 2),
      "utf8",
    );

    // Copy all files except manifest.json to firefox
    const files = fs.readdirSync("./dist");
    for (const file of files) {
      if (file !== "firefox" && file !== "manifest.json" && file !== "images") {
        fs.copyFileSync(`./dist/${file}`, `./dist/firefox/${file}`);
      }
    }

    // images folder copy
    fs.mkdirSync("./dist/firefox/images", { recursive: true });
    const firefoxImages = fs.readdirSync("./images");
    for (const image of firefoxImages) {
      fs.copyFileSync(`./images/${image}`, `./dist/firefox/images/${image}`);
    }

    // Create a zip file
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream("./dist/firefox.zip");
      const archive = archiver("zip", {
        zlib: { level: 9 }, // Sets the compression level.
      });

      output.on("close", resolve);
      output.on("error", reject);

      archive.on("warning", (err) => {
        if (err.code !== "ENOENT") reject(err);
      });
      archive.on("error", reject);

      archive.pipe(output);
      archive.directory("./dist/firefox", false);
      archive.finalize().catch(reject);
    });

    fs.rmSync("./dist/firefox", { recursive: true });
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
})();

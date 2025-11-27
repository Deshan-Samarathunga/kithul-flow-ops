const { app, BrowserWindow, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const dotenv = require("dotenv");

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL || "http://localhost:8080";
const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
let stopBackend = null;

async function bootBackend() {
  if (isDev) return;

  const serverRoot = app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.resolve(__dirname, "../../server");
  const serverEntry = path.join(serverRoot, "dist", "index.js");

  if (!fs.existsSync(serverEntry)) {
    console.warn("[backend] missing server entry:", serverEntry);
    return;
  }

  const envPath = path.join(serverRoot, ".env");
  if (fs.existsSync(envPath)) {
    try {
      dotenv.config({ path: envPath, override: false });
      process.env.DOTENV_CONFIG_PATH = envPath;
    } catch (error) {
      console.warn("[backend] failed to load env file", error);
    }
  }

  const storageRoot = path.join(app.getPath("userData"), "storage");
  fs.mkdirSync(storageRoot, { recursive: true });
  process.env.APP_DATA_DIR = storageRoot;

  try {
    const serverModule = await import(pathToFileURL(serverEntry).href);
    if (typeof serverModule.startServer === "function") {
      await serverModule.startServer({
        port: Number(process.env.SERVER_PORT ?? process.env.PORT ?? 5000),
        clientOrigin: "app://-",
      });
      if (typeof serverModule.stopServer === "function") {
        stopBackend = serverModule.stopServer;
      }
      console.log("[backend] server started");
    } else {
      console.warn("[backend] startServer export not found");
    }
  } catch (error) {
    console.error("[backend] failed to start", error);
    throw error;
  }
}

/**
 * Creates the main renderer window for the desktop shell.
 */
async function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "undocked" });
  } else {
    const indexHtmlPath = path.join(__dirname, "../dist/index.html");
    await mainWindow.loadFile(indexHtmlPath);
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.whenReady().then(async () => {
  try {
    await bootBackend();
  } catch (error) {
    console.error("Failed to boot backend", error);
  }

  createMainWindow().catch((err) => {
    console.error("Failed to create window", err);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow().catch((err) => console.error(err));
    }
  });
});

app.on("will-quit", async (event) => {
  if (!stopBackend) {
    return;
  }

  event.preventDefault();
  const shutdown = stopBackend;
  stopBackend = null;

  try {
    await shutdown();
  } catch (error) {
    console.error("[backend] failed to stop", error);
  } finally {
    app.exit(0);
  }
});

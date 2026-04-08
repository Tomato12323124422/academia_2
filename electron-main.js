const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'frontend/assets/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    // In production, we might want to point it to the Render URL
    // For now, let's point it to the local index.html or the localhost
    if (isDev) {
        mainWindow.loadURL('http://localhost:5000');
    } else {
        mainWindow.loadFile(path.join(__dirname, 'frontend/index.html'));
    }

    // Remove menu bar
    // Menu.setApplicationMenu(null);

    // Open DevTools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

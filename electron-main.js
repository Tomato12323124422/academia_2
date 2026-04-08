const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

// Start Backend Server
try {
    console.log('Starting internal backend server...');
    require('./backend/index.js');
} catch (err) {
    console.error('Failed to start internal backend:', err);
}

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

    // Use RENDER_URL if provided, else localhost (dev), else local file
    const remoteUrl = process.env.RENDER_URL || 'https://academia-2-xgdr.onrender.com';
    
    if (process.env.USE_REMOTE === 'true') {
        mainWindow.loadURL(remoteUrl);
    } else if (isDev) {
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

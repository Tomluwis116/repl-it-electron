import { Launcher, Updater } from './launcher/launcher';
import { app, dialog, Menu } from 'electron';
import { sep } from 'path';
import { PLATFORM, promptYesNoSync } from './common';
import { App } from './app/app';
import { appMenuSetup } from './app/menu/appMenuSetup';

app.setPath(
    'appData',
    app.getPath('home') + sep + '.repl.it' + sep + 'appData' + sep
);
app.setPath(
    'userData',
    app.getPath('home') + sep + '.repl.it' + sep + 'userData' + sep
);
let launcher: Launcher;
let updater: Updater;
let mainApp: App;

function initLauncher() {
    launcher = new Launcher();
    launcher.init();
    launcher.window.webContents.once('did-finish-load', () => {
        launcher.window.show();
        initUpdater().then(() => {});
    });
}

async function initApp() {
    mainApp = new App();
    mainApp.mainWindow.loadURL('https://repl.it/~').then();
    await mainApp.clearCookies(true);
    mainApp.mainWindow.webContents.once('did-finish-load', () => {
        mainApp.mainWindow.show();
        launcher.window.close();
    });
}

async function initUpdater() {
    updater = new Updater(launcher);
    launcher.updateStatus({ text: 'Checking Update' });
    const res = await updater.checkUpdate();
    if (res['changeLog'] == 'error') {
        launcher.updateStatus({
            text: 'Check update failed, skipping.'
        });
        updater.cleanUp(true);
    }
    updater.once('download-error', (e) => {
        console.error(e);
        updater.cleanUp();
    });
    updater.once('all-done', () => {
        launcher.updateStatus({ text: 'Launching app' });
        initApp();
    });
    if (res['hasUpdate']) {
        launcher.updateStatus({ text: 'Update detected' });
        if (
            promptYesNoSync(
                `A new update ${res['version']} is available. Do you want to update?`,
                'Update Available',
                res['changeLog']
            )
        ) {
            launcher.updateStatus({ text: 'Downloading Update' });
            switch (PLATFORM) {
                case 'win32':
                    updater.once('download-finished', updater.afterDownloadWin);
                    await updater.downloadUpdate(
                        updater.downloadUrls.windowsUrl
                    );
                    break;
                case 'darwin':
                    updater.once('download-finished', updater.afterDownloadMac);
                    await updater.downloadUpdate(updater.downloadUrls.macOSUrl);
                    break;
                case 'linux':
                    updater.once(
                        'download-finished',
                        updater.afterDownloadLinux
                    );
                    await updater.downloadUpdate(updater.downloadUrls.linuxUrl);
                    break;
            }
        } else {
            updater.cleanUp(true);
        }
    }
}

app.on('window-all-closed', () => {
    app.quit();
});
app.once('ready', () => {
    initLauncher();
});

// src/extension.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import archiver = require('archiver');

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('save-as-zip.saveAsZip', async (uri: vscode.Uri) => {
        try {
            // Check if uri exists and is a folder
            if (!uri) {
                throw new Error('No folder selected');
            }

            // Check if the path exists and is a directory
            const stats = await vscode.workspace.fs.stat(uri);
            if (!(stats.type === vscode.FileType.Directory)) {
                throw new Error('Selected item is not a folder');
            }

            // Get the folder path and create zip file path
            const folderPath = uri.fsPath;
            const folderName = path.basename(folderPath);
            const zipPath = path.join(path.dirname(folderPath), `${folderName}.zip`);

            // Check if zip file already exists
            if (fs.existsSync(zipPath)) {
                const result = await vscode.window.showWarningMessage(
                    `${folderName}.zip already exists. Do you want to replace it?`,
                    'Yes',
                    'No'
                );
                if (result !== 'Yes') {
                    return;
                }
                // Delete existing zip file
                fs.unlinkSync(zipPath);
            }

            // Create progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Creating ${folderName}.zip`,
                cancellable: false
            }, async (progress) => {
                return new Promise<void>((resolve, reject) => {
                    const output = fs.createWriteStream(zipPath);
                    const archive = archiver('zip', {
                        zlib: { level: 9 } // Maximum compression
                    });

                    output.on('close', () => {
                        const fileSizeInBytes = archive.pointer();
                        let fileSize: string;
                        
                        if (fileSizeInBytes < 1024) {
                            fileSize = `${fileSizeInBytes} B`;
                        } else if (fileSizeInBytes < 1024 * 1024) {
                            fileSize = `${(fileSizeInBytes / 1024).toFixed(1)} KB`;
                        } else {
                            fileSize = `${(fileSizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
                        }
                        
                        vscode.window.showInformationMessage(
                            `Successfully created ${folderName}.zip (${fileSize})`
                        );
                        resolve();
                    });

                    archive.on('error', (err) => {
                        reject(err);
                    });

                    // Update progress based on bytes processed
                    let lastProgressUpdate = 0;
                    archive.on('progress', (progressData) => {
                        const percentage = Math.floor((progressData.fs.processedBytes / progressData.fs.totalBytes) * 100);
                        if (percentage >= lastProgressUpdate + 10) {
                            progress.report({ 
                                increment: percentage - lastProgressUpdate,
                                message: `${percentage}% complete`
                            });
                            lastProgressUpdate = percentage;
                        }
                    });

                    // Pipe archive data to the output file
                    archive.pipe(output);

                    // Add the folder contents to the archive
                    archive.directory(folderPath, folderName);

                    // Finalize the archive
                    archive.finalize();
                });
            });

        } catch (error) {
            if (error instanceof Error) {
                vscode.window.showErrorMessage(`Error creating zip: ${error.message}`);
            } else {
                vscode.window.showErrorMessage('An unknown error occurred while creating the zip file');
            }
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
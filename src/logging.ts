import * as vscode from 'vscode';

const levels = {
  debug: 10,
  normal: 20,
  warning: 30,
  error: 40,
} as const;

type LogLevel = keyof typeof levels;

export class Logger implements vscode.Disposable {
  readonly outputChannel: vscode.LogOutputChannel;
  private readonly minimumLevel: number;

  constructor(level: string) {
    this.outputChannel = vscode.window.createOutputChannel('OpenVox', { log: true });
    this.minimumLevel = levels[level as LogLevel] ?? levels.normal;
  }

  debug(message: string): void {
    this.write('debug', message);
  }

  normal(message: string): void {
    this.write('normal', message);
  }

  warning(message: string): void {
    this.write('warning', message);
  }

  error(message: string): void {
    this.write('error', message);
  }

  show(): void {
    this.outputChannel.show();
  }

  dispose(): void {
    this.outputChannel.dispose();
  }

  private write(level: LogLevel, message: string): void {
    if (levels[level] < this.minimumLevel) {
      return;
    }

    this.outputChannel.appendLine(`${level.toUpperCase()}: ${new Date().toISOString()} ${message}`);
  }
}

import { injectable } from 'inversify';
import { ILogger } from '../../shared/interfaces/ILogger';

@injectable()
export class ConsoleLogger implements ILogger {
  public info(message: string, data?: any): void {
    console.log(`[INFO] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  public warn(message: string, data?: any): void {
    console.warn(`[WARN] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  public error(message: string, data?: any): void {
    console.error(`[ERROR] ${message}`, data ? JSON.stringify(data, null, 2) : '');
  }

  public debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${message}`, data ? JSON.stringify(data, null, 2) : '');
    }
  }
}
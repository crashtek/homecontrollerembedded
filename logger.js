import {createLogger, transports, format} from 'winston';
import 'winston-daily-rotate-file';

const transport = new transports.DailyRotateFile({
  dirname: 'logs',
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '365d',
  timestamp: true,
  level: process.env.LOG_LEVEL,
  handleExceptions: true,
  json: false,
  colorize: true
});

transport.on('rotate', function(oldFilename, newFilename) {
  // do something fun
  logger.info(`Rotating from ${oldFilename} to ${newFilename}`);
});

const logger = createLogger({
  format: format.timestamp(),
  transports: [
    transport
  ],
  exitOnError: false
});

export default logger;

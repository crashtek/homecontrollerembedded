import config from './config';
import winston from 'winston';
import 'winston-daily-rotate-file';

winston.emitErrs = true;

const transport = new winston.transports.DailyRotateFile({
  filename: 'application-%DATE%.log',
  datePattern: 'YYYY-MM-DD-HH',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '365d',
  timestamp: true,
  level: config('LOG_LEVEL'),
  handleExceptions: true,
  json: false,
  colorize: true
});

transport.on('rotate', function(oldFilename, newFilename) {
  // do something fun
  logger.info(`Rotating from ${oldFilename} to ${newFilename}`);
});

const logger = new winston.Logger({
  transports: [
    transport
  ],
  exitOnError: false
});

export default logger;

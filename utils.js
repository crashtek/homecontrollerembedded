import fs from "fs";
import axios from 'axios';
import logger from './logger';

export const tryToReadJsonFile = (fileName, defaultValue) => {
  try {
    const fileContents = fs.readFileSync(fileName);
    return JSON.parse(fileContents);
  } catch(err) {
    // Ignore this error, it just means we don't have any stored auth data yet
    console.log(`No Data Found in ${fileName}, ignoring: `, err.message);
  }

  return defaultValue;
};

export const commandWindow = async (ip, command, seconds) => {
  const secondsToCommand = seconds ? seconds : 200;
  const commandStr = {
    up: 6,
    down: 5
  };

  const url = `http://${ip}/${commandStr[command]}/${secondsToCommand}`;
  logger.info('Sending command: ', url);
  return await axios.post(url, {
    timeout: 5000
  })
    .then(() => true)
    .catch(err => {
      logger.info(`Got error: ${err.message}`)
      return false;
    })

};

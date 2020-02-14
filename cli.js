import dotenv from 'dotenv';
import axios from 'axios';
import fs from "fs";

import authService from './auth';
import { tryToReadJsonFile } from './utils';
import ScheduleClock from './ScheduleClock';
import logger from './logger';


dotenv.config();

const dataStoreName = '.datastore.json';

let lastLastSync = null;
let lastSync = null;
let lastErrorTimeout= 500;
let config = null;
let clock = null;

let counter = 0;

const doNext = async () => {
  if (counter <= 0) {
    counter = 10;
    logger.info('looping...');
  } else {
    counter--;
  }

  const user = await authService.getUser();

  // Check if we've gotten a config yet, update it if not
  if (!config) {
    config = tryToReadJsonFile(dataStoreName, []);
    logger.info('got config: ', config);
    clock = new ScheduleClock(config);
    if (config.length > 0) {
      logger.info('Found config in datastore');
      config.forEach(room => {
        if (lastSync < room.lastUpdate) lastSync = room.lastUpdate;
      });
    }
  }

  const url = lastSync ? `${process.env.WEB_SERVICE_URL}/api/command/next?homeId=1&lastSync=${lastSync}` :
    `${process.env.WEB_SERVICE_URL}/api/command/next?homeId=1`;
  if (lastLastSync !== lastSync) {
    lastLastSync = lastSync;
    logger.info('requesting command from: ', url);
  }
  const keepGoing = await axios
    .get(url, {
      headers: {
        authorization: `Bearer ${user.access_token}`
      },
      timeout: 30000
    })
    .then( response => {
      lastErrorTimeout = 500;
      if (response.data.command && response.data.command.type === 'configUpdate') {
        lastSync = Date.now();
        logger.info('Got Config: ', response.data.command.config);
        config = response.data.command.config;
        fs.writeFileSync(dataStoreName, JSON.stringify(response.data.command.config));
        clock.setRooms(config);
      }

      return true;
    })
    .catch(err => {
      if (err.response && err.response.data && err.response.data.error === 'LongPollExpired') {
        lastErrorTimeout = 500;
        // logger.info('Long Poll Expired, trying again...');
        return true;
      }

      if (lastErrorTimeout < 30000) lastErrorTimeout = lastErrorTimeout * 2;
      logger.info(`Got an error waiting for response from web: ${err.message} waiting ${lastErrorTimeout/1000} second(s) before continuing`);
      setTimeout(doNext, lastErrorTimeout);
      return false; // Don't call doNext because we are going to wait some before calling it again
    });

  if (keepGoing) return doNext();
};

authService.waitForUser(false)
  .then(user => {
    logger.info('Welcome ', user.name);
    return doNext();
  })
  .catch(console.error);

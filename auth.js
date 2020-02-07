import fs from 'fs';
import axios from 'axios';
import qs from 'querystring';
import qrcode from 'qrcode';
import jwt from 'jsonwebtoken';
import open from 'open';
import { tryToReadJsonFile } from './utils';

class AuthService {
  constructor() {
    this.dataStoreName = '.authData.json';
    this.authData = tryToReadJsonFile(this.dataStoreName, {});

    this.verificationResponse = null;
  }

  async postToAuth(path, params) {
    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    return axios
      .post(`${process.env.ISSUER_BASE_URL}${path}`, qs.stringify(params), config)
      .then(response => response.data)
      .catch(error => {
        if (error.response && error.response.data) return error.response.data;
        console.error('Got an unexpected error: ', error.message);
        throw error;
      });
  }

  async getCode() {
    // First Call the device/code endpoint so we can initiate the login request
    const codeData = await this.postToAuth('/oauth/device/code', {
      client_id: process.env.CLIENT_ID,
      scope: 'openid profile offline_access',
      audience: process.env.AUDIENCE
    });

    // Now that we have data from device/code, we need to generate a QR code so that it can be
    // displayed to the user as an easy way for them to initiate the actual authentication request on their device
    const urlQrCode = await qrcode.toString(codeData.verification_uri_complete, {type:'terminal'});
    this.verificationResponse = codeData;

    // Here we return more than just the code because we leave it up to the application to decide how to display it
    // to the user.  Perhaps we could have the SDK provide some OOTB options.  Having a terminal display might be good.

    this.loginRequestData = {
      qrText: urlQrCode,
      ...codeData,
      expires_at: Date.now() + codeData.expires_in * 1000
    };

    return this.loginRequestData;
  }

  processTokenResults(tokens) {
    // hooray, got some tokens!
    this.authData.user = jwt.decode(tokens.id_token);
    this.authData.user.access_token = tokens.access_token;
    this.authData.user.expires_at = tokens.expires_in * 1000 + Date.now();
    if (tokens.refresh_token) {
      this.authData.refreshToken = tokens.refresh_token;
    }

    fs.writeFileSync(this.dataStoreName, JSON.stringify(this.authData));
  }

  keepCheckingLogin(expiresAt, resolve, reject) {
    return this.checkLogin()
      .then(userIsLoggedIn => {
        if (userIsLoggedIn) return resolve(this.authData.user);
        if ((Date.now() + this.loginRequestData.interval * 1000) > expiresAt)
          return reject(new Error('timed out waiting for login'));
        return setTimeout(this.keepCheckingLogin.bind(this), this.loginRequestData.interval * 1000, expiresAt, resolve, reject);
      })
      .catch(reject);
  }

  async waitForUserUntil(expiresAt) {
    return new Promise((resolve, reject) => this.keepCheckingLogin(expiresAt, resolve, reject));
  }

  async waitForUser(auto) {
    if (this.authData.user) return this.authData.user;

    const loginData = this.verificationResponse ? this.verificationResponse : await this.getCode();
    if (auto) {
      // Fetch the code if it hasn't been done yet
      console.log('Attempting to open the browser');
      open(loginData.verification_uri_complete);
    } else {
      console.log('Try using this QR code or clicking this link', loginData.verification_uri_complete, ' MAKE SURE' +
        ' THIS CODE IS VISIBLE!!! ', loginData.user_code);
      console.log(loginData.qrText);
    }

    // wait for the user to log in
    return await this.waitForUserUntil(this.loginRequestData.expires_at);
  }

  // checks if the user has logged in yet by calling the /oauth/token endpoint with the device code
  async checkLogin() {
    const decodedData = await this.postToAuth('/oauth/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      device_code: this.verificationResponse.device_code,
      client_id: process.env.CLIENT_ID
    });

    if (decodedData.error) {
      switch(decodedData.error) {
        case 'authorization_pending': console.log('Not ready yet'); break;
        case 'slow_down':
          this.loginRequestData.interval += 1;
          console.log('Slow Down!');
          break;
        case 'access_denied':
          console.error('User is not authorized');
          process.exit(-1)
          break;
        default:
          console.error(`Unexpected error: ${decodedData.error}`)
          process.exit(-1)
          break;
      }

      return false;
    }

    this.processTokenResults(decodedData);
    return true;
  }

  async getUser() {
    if (this.isAuthenticated()) {
      if (this.authData.user.expires_at < Date.now()) {
        // refresh the user's tokens
        const decodedData = await this.postToAuth('/oauth/token', {
          grant_type: 'refresh_token',
          refresh_token: this.authData.refreshToken,
          client_id: process.env.CLIENT_ID
        });

        this.processTokenResults(decodedData)
      }
    }

    return this.authData.user;
  }

  isAuthenticated() { return !!this.authData.user; }

  async logout() {
    return new Promise((resolve) => {
      fs.exists(this.dataStoreName, (exists) => {
        if(exists) {
          fs.unlinkSync(this.dataStoreName);
        }

        this.authData = {};
        open(`${process.env.ISSUER_BASE_URL}/v2/logout`);
        resolve();
      })
    });
  }
}

const authService = new AuthService();

export default authService;

const path = require('path');
require('@babel/register');
require("@babel/polyfill");

require(path.join(__dirname, 'cli.js')); // eslint-disable-line import/no-dynamic-require

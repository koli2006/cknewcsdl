const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Chrome download වෙන path එක project root එකේ .cache folder එකට මාරු කරයි
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};


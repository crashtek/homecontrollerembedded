import fs from "fs";

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

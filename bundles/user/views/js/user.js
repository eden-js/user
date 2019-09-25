/* eslint-disable global-require */
/* eslint-disable no-underscore-dangle */

// get dotProp
const dotProp = require('dot-prop');

// Create mixin
module.exports = (toMix) => {
  // On mount update
  if (!toMix.eden.frontend) {
    // Set acl
    toMix.user = {
      __data : toMix.eden.get('user') || {},
    };

    // set acl
    toMix.user.acl = require('user/public/js/acl');

    // Add get method
    toMix.user.get = (key) => {
      // Check key
      if (!key) return toMix.user.__data;

      // Return id
      return dotProp.get(toMix.user.__data, key);
    };

    // Add set method
    toMix.user.set = (key, value) => {
      // Return id
      dotProp.set(toMix.user.__data, key, value);
    };

    // Add normal functions
    toMix.user.exists = () => {
      // Return id
      return !!toMix.user.get('_id');
    };
  } else {
    // Check user loaded
    toMix.user = require('user/public/js/bootstrap');

    // On update
    toMix.user.on('update', toMix.update);

    // On unmount
    toMix.on('unmount', () => {
      // Remove on update
      toMix.user.removeListener('update', toMix.update);
    });
  }
};

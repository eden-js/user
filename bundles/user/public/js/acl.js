/* eslint-disable no-underscore-dangle */
// Require dependencies
const dotProp = require('dot-prop-immutable');

// Require local dependencies
const store = require('core/public/js/store');

/**
 * Build acl class
 */
class AclStore {
  /**
   * Construct acl class
   */
  constructor() {
    // Bind methods
    this.list = this.list.bind(this);
    this.validate = this.validate.bind(this);
  }

  /**
   * Validates acl
   *
   * @param {Array} tests
   * @param {Array} list
   *
   * @returns {Boolean}
   */
  validate(tests, list) {
    // Get list
    let obj = {};
    const user = store.user || store.get('user');

    // Set list
    list = list || this.list();

    // Check is array
    if (Array.isArray(list)) {
      // Set list
      for (const item of list) {
        // Set value
        obj = dotProp.set(obj, item, true);
      }
    }

    // Set array if not
    if (!Array.isArray(tests)) tests = [tests];

    // Find failed test
    return !(tests.filter((test) => {
      // Check if true/false
      if (test.toString() === 'true' && (!user || (!user._id && !(user.__data || {})._id))) return true;
      if (test.toString() === 'false' && (user && (user._id || (user.__data || {})._id))) return true;

      // Check list
      if (list === true) return false;

      // Loop props
      return !dotProp.get(obj, test) && !dotProp.get(obj, `${test.split('.').slice(0, -1).join('.')}.*`);
    })).length;
  }

  /**
   * Gets acl list from user
   *
   * @returns {Array}
   */
  list() {
    // Set user
    const user = store.user || store.get('user');

    // Return array if no user
    if (!user || !(typeof user.get === 'function' ? user.get('_id') : user._id)) return [];

    // Get groups
    const userAcls = (typeof user.get === 'function' ? user.get('acl') : user.acl) || [];

    // Loop Acls
    if (userAcls.find(val => val.value === true)) return true;

    // reduce to list
    return userAcls.reduce((accum, acl) => {
      // loop values
      acl.value.forEach((val) => {
        // push value
        if (!accum.includes(val)) accum.push(val);
      });

      // return accumulated
      return accum;
    }, []);
  }
}

/**
 * Export acl class
 *
 * @type {acl}
 */
module.exports = new AclStore();

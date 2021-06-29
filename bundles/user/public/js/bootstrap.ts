/* eslint-disable no-underscore-dangle */

// Require riot
import dotProp from 'dot-prop';
import { EventEmitter } from 'events';

// Require dependencies
import acl from 'user/public/js/acl';
import store from 'core/public/js/store';
import socket from 'socket/public/js/bootstrap';

/**
 * Build alert class
 */
class EdenUser extends EventEmitter {
  /**
   * Construct edenAlert class
   */
  constructor(...args) {
    // Run super
    super(...args);

    // Set private fields
    this.__data = {};
    this.__fields = [];

    // Set acl
    this.acl = acl;

    // Bind methods
    this.get = this.get.bind(this);
    this.set = this.set.bind(this);
    this.build = this.build.bind(this);
    this.exists = this.exists.bind(this);
    this.refresh = this.refresh.bind(this);

    // Bind private methods
    this.__update = this.__update.bind(this);

    // Build user
    this.building = this.build();

    // set max listeners
    this.setMaxListeners(0);
  }

  // ////////////////////////////////////////////////////////////////////////////
  //
  // BUILD METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Builds user
   */
  build() {
    // Set values
    const user = store.get('user');

    // Set user
    this.__data = user || {};

    // Pre user
    store.pre('set', (data) => {
      // Check key
      if (data.key !== 'user') return;

      // Set value
      this.__update(data.val);

      // Set val
      data.val = this;
    });

    // On user socket
    socket.on('user', this.__update);
  }

  // ////////////////////////////////////////////////////////////////////////////
  //
  // GET/SET METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Sets key value
   *
   * @param {String} key
   *
   * @returns {*}
   */
  get(key, d) {
    // Check key
    if (!key || !key.length) return this.__data;

    // Return this key
    const got = dotProp.get(this.__data, key);

    // check got
    if (typeof got === 'undefined') {
      return d;
    }

    // return got
    return got;
  }

  /**
   * Sets key value
   *
   * @param {String} key
   * @param {*}      value
   */
  set(key, value) {
    // set value
    dotProp.set(this.__data, key, value);

    // Check in fields
    if (!this.__fields.includes(key)) this.__fields.push(key);

    // Trigger key
    this.emit(key, value);

    // set key
    if (key.includes('.')) this.emit(key.split('.')[0], value);

    // return this
    return this.get(key);
  }

  // ////////////////////////////////////////////////////////////////////////////
  //
  // MISC METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Clears user
   */
  clear() {
    // Loop fields
    this.__data = {};
  }

  /**
   * Return exists
   *
   * @return {Boolean}
   */
  exists() {
    // Return this.id
    return !!this.get('_id');
  }

  /**
   * Refresh user
   */
  async refresh() {
    // Refresh
    this.__update(await socket.call('user.refresh'));
  }

  // ////////////////////////////////////////////////////////////////////////////
  //
  // UPDATE METHODS
  //
  // ////////////////////////////////////////////////////////////////////////////

  /**
   * Sets user
   *
   * @param  {Object} User
   */
  __update(user) {
    // return if user is user entity
    if (user.__data) return null;

    // Set built
    store.user = builtUser;

    // Check no user
    if (!user) return this.clear();

    // Emit stuff
    Object.keys(user).forEach((key) => {
      // Set value
      if (JSON.stringify(this.get(key)) !== JSON.stringify(user[key])) {
        // Set value
        this.set(key, user[key]);
      }

      // Check in fields
      if (!this.__fields.includes(key)) this.__fields.push(key);
    });

    // Update user
    return this.emit('update');
  }
}

/**
 * Build alert class
 *
 * @type {edenAlert}
 */
const builtUser = new EdenUser();

/**
 * Add user to window.eden
 */
window.eden.user = builtUser;

/**
 * Export alert class
 *
 * @type {user}
 */
export default builtUser;

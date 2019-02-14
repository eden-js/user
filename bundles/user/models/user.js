// Require local dependencies
const eden   = require('eden');
const Model  = require('model');
const config = require('config');
const crypto = require('crypto');
const socket = require('socket');

/**
 * Create user model class
 */
class User extends Model {
  /**
   * Construct user model class
   */
  constructor() {
    // Run super
    super(...arguments);

    // Bind auth methods
    this.authenticate = this.authenticate.bind(this);

    // Bind socket methods
    this.emit = this.emit.bind(this);
    this.name = this.name.bind(this);
    this.alert = this.alert.bind(this);
    this.sanitise = this.sanitise.bind(this);
  }

  /**
   * Authenticates user
   *
   * @param {String} password
   *
   * @returns {Promise}
   */
  async authenticate(password) {
    // Compare hash with password
    const hash  = this.get('hash');
    const check = crypto
      .createHmac('sha256', config.get('secret'))
      .update(password)
      .digest('hex');

    // Check if password correct
    if (check !== hash) {
      return {
        info  : 'Incorrect password',
        error : true,
      };
    }

    // Password accepted
    return true;
  }

  /**
   * Returns users name
   *
   * @return {String} name
   */
  name() {
    // Check name
    const name = `${this.get('first') || ''} ${this.get('last') || ''}`;

    // Return name
    return (name === ' ' ? (this.get('email') || this.get('username')) : name).trim();
  }

  /**
   * Emits to socketio
   *
   * @param  {String} type
   * @param  {Object} data
   *
   * @return {*}
   */
  emit(type, data) {
    // Return socket emission
    return socket.user(this, type, data);
  }

  /**
   * Alerts user
   *
   * @param  {String} message
   * @param  {String} type
   * @param  {Object} options
   *
   * @return {*}
   */
  alert(message, type, options) {
    // Return socket emission
    return socket.alert(this, message, type, options);
  }

  /**
   * Sanitises user
   *
   * @return {*}
   */
  async sanitise() {
    // return object
    const sanitised = {
      id         : this.get('_id') ? this.get('_id').toString() : null,
      _id        : this.get('_id') ? this.get('_id').toString() : null,
      created_at : this.get('created_at'),
      updated_at : this.get('updated_at'),
    };

    // add other fields
    for (const field of config.get('user.fields')) {
      // set sanitised
      sanitised[field.name] = await this.get(field.name);
      sanitised[field.name] = sanitised[field.name] && sanitised[field.name].sanitise ? await sanitised[field.name].sanitise() : sanitised[field.name];
      sanitised[field.name] = Array.isArray(sanitised[field.name]) ? await Promise.all(sanitised[field.name].map((val) => {
        // return sanitised value
        if (val.sanitise) return val.sanitise();
      })) : sanitised[field.name];
    }

    // await hook
    await this.eden.hook('user.sanitise', {
      sanitised,
      user : this,
    });

    // return sanitised
    return sanitised;
  }
}

/**
 * Export user model
 * @type {user}
 */
exports = module.exports = User;

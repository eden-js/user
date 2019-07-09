
// Require dependencies
const Model = require('model');

/**
 * Create acl model
 */
class Acl extends Model {
  /**
   * Sanitises acl class
   *
   * @return {*}
   */
  sanitise() {
    // Return id/name/value
    return {
      id    : this.get('_id') ? this.get('_id').toString() : false,
      name  : this.get('name'),
      value : this.get('value'),
    };
  }
}

/**
 * Export acl model
 * @type {acl}
 */
module.exports = Acl;

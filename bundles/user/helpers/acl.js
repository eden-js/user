// Require dependencies
const dotProp = require('dot-prop');

/**
 * Build acl class
 */
class AclHelper {
  /**
   * Construct acl class
   */
  constructor() {
    // Bind methods
    this.list = this.list.bind(this);
    this.validate = this.validate.bind(this);
    this.middleware = this.middleware.bind(this);
  }

  /**
   * Validates acl list against user
   *
   * this method will return false if the user does not have access to a certain
   * acl list, to check an acl against a user simply:
   *   await AclHelper.validate (User, ['user.view', 'user.create'])
   *    OR
   *   await AclHelper.validate (User, 'user.view')
   *
   * @param {User}    user
   * @param {*|Array} tests
   *
   * @return {Promise}
   */
  async validate(user, tests) {
    // Get list
    const obj = {};
    const list = await this.list(user);

    // Check is array
    if (Array.isArray(list)) {
      // Set list
      for (const item of list) {
        // Set value
        dotProp.set(obj, item, true);
      }
    }

    // Set array if not
    if (!Array.isArray(tests)) tests = [tests];

    // Find failed test
    return !(tests.filter((test) => {
      // Check if true/false
      if (test.toString() === 'true' && !user) return true;
      if (test.toString() === 'false' && user) return true;

      // Check list
      if (list === true) return false;

      // Loop props
      return !dotProp.get(obj, test) && !dotProp.get(obj, `${test.split('.').slice(0, -1).join('.')}.*`);
    })).length;
  }

  /**
   * Lists and flattens acl applied to a user
   *
   * this method will return an array of group acls associated with a particular
   * user, to use this method simply:
   *    await AclHelper.list (user)
   *
   * if this method returns `true` this means the user is a super administrator
   *
   * @param {User} user
   *
   * @return {Array|Boolean}
   * @private
   */
  async list(user) {
    // Return array if no user
    if (!user) return [];

    // Get groups
    const acls = (await user.get('acl') || []).filter(acl => acl && acl.get);

    // check value
    if (acls.find(acl => acl.get('value') === true)) return true;

    // reduce
    return acls.reduce((accum, acl) => {
      // reduce values
      acl.get('value').forEach((val) => {
        // push value if not exists
        if (!accum.includes(val)) accum.push(val);
      });

      // return accum
      return accum;
    }, []);
  }

  /**
   * Expressjs middleware for checking route acl against the current user
   *
   * if this fails, either the user will be redirected to the resulting
   * directive labeled by @fail, or will be sent to the next route using:
   *    @fail /route/to/redirect/to
   *      OR
   *    @fail next
   *
   * @param {request}  req
   * @param {response} res
   * @param {callback} next
   *
   * @return {Integer}
   */
  async middleware(req, res, route) {
    // Check route has acl
    if (!route || (typeof route.acl === 'undefined')) return true;

    // Check acl
    const check = await this.validate(req.user, route.acl);

    // Check if true
    if (!check) {
      // Check if redirect
      if (route.fail) {
        // Check if next
        if (route.fail === 'next') {
          // Return false
          return 0;
        }

        // Redirect to fail auth redirect
        res.redirect(route.fail);

        // Return false
        return 2;
      }

      // Redirect home
      res.redirect('/');

      // Return false
      return 2;
    }

    // Do next
    return 1;
  }
}

/**
 * Export AclHelper class
 *
 * @type {AclHelper}
 */
module.exports = new AclHelper();

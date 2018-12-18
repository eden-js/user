
// Require dependencies
const Local       = require('passport-local').Strategy;
const crypto      = require('crypto');
const config      = require('config');
const socket      = require('socket');
const passport    = require('passport');
const Controller  = require('controller');
const escapeRegex = require('escape-string-regexp');

// Require models
const Acl   = model('acl');
const User  = model('user');
const Block = model('block');
const Login = model('login');

// Require local dependencies
const AclHelper   = helper('user/acl');
const EmailHelper = helper('email');
const BlockHelper = helper('cms/block');

/**
 * Create user controller
 *
 * @priority 10
 */
class UserController extends Controller {

  /**
   * Constructor for user controller
   *
   * @param {eden} eden
   */
  constructor () {
    // Run super
    super();

    // Bind methods
    this.build                = this.build.bind(this);
    this.loginAction          = this.loginAction.bind(this);
    this.logoutAction         = this.logoutAction.bind(this);
    this.refreshAction        = this.refreshAction.bind(this);
    this.registerAction       = this.registerAction.bind(this);
    this.loginSubmitAction    = this.loginSubmitAction.bind(this);
    this.registerSubmitAction = this.registerSubmitAction.bind(this);

    // Bind private methods
    this._user         = this._user.bind(this);
    this._login        = this._login.bind(this);
    this._logout       = this._logout.bind(this);
    this._deserialise  = this._deserialise.bind(this);
    this._authenticate = this._authenticate.bind(this);

    // Run
    this.build();
  }

  /**
   * Builds user controller
   */
  build () {
    // On render
    this.eden.pre('view.compile', (render) => {
      // Move menus
      if (render.state.user) render.user = render.state.user;

      // Delete from state
      delete render.state.user;
    });

    // Login event listeners
    this.eden.on('user.login',      this._login);
    this.eden.on('user.logout',     this._logout);
    this.eden.on('user.login.fail', this._login);

    // Hook listen methods
    this.eden.pre('user.register', this._register);

    // Initialize passport
    this.eden.router.use(passport.initialize());
    this.eden.router.use(passport.session());

    // Create local strategy
    passport.use(new Local(this._authenticate));

    // Serializes user
    passport.serializeUser((user, done) => {
      // Emit done
      done(null, user.get('_id').toString());
    });

    // Deserialize user
    passport.deserializeUser(this._deserialise);

    // Add user to locals
    this.eden.router.use(this._user);

    // Check acl
    this._acl();

    // set blocks
    let blocks = ['login', 'register', 'forgot'];

    // do blocks
    blocks.forEach((b) => {
      // get uppercase
      let upper = b.charAt(0).toUpperCase() + b.slice(1);

      // register simple block
      BlockHelper.block('user.' + b, {
        'acl'         : false,
        'for'         : ['frontend'],
        'title'       : upper + ' Form',
        'description' : upper + ' Form block'
      }, async (req, block) => {
        // return
        return {
          'tag' : b
        };
      }, async (req, block) => { });
    });
  }

  /**
   * Refresh user action
   *
   * @param  {Object}  opts
   *
   * @call user.refresh
   *
   * @return {Promise}
   */
  async refreshAction (opts) {
    // Return opts
    if (opts.user) {
      // Sanitise user
      return await opts.user.sanitise();
    } else {
      return null;
    }
  }

  /**
   * Login action
   *
   * @param {Request}  req
   * @param {Response} res
   *
   * @acl      false
   * @fail     /
   * @menu     {MAIN} Login
   * @title    Login
   * @route    {get} /login
   * @priority 2
   */
  loginAction (req, res) {
    // Render login page
    res.render('login', {
      'redirect' : req.query.redirect || false
    });
  }

  /**
   * Login form action
   *
   * @param {Request}  req
   * @param {Response} res
   * @param {Function} next
   *
   * @acl   false
   * @fail  /
   * @title Login
   * @route {post} /login
   */
  loginSubmitAction (req, res, next) {
    // Authenticate with passport
    passport.authenticate('local', (err, user, info) => {
      // Check user exists
      if (!user || err) {
        // Alert user
        req.alert('error', err || info.message);

        // Emit event
        this.eden.emit('user.login.fail', {
          'req'     : req,
          'fail'    : true,
          'user'    : info.user,
          'message' : err || info.message
        });

        // Render login page
        return res.render('login', {
          'old'      : req.body,
          'redirect' : (req.query || {}).redirect || req.body.redirect || false
        });
      }

      // Do passport login
      req.login(user, {}, async () => {
        // Emit to socket
        socket.session(req.sessionID, 'user', await user.sanitise());

        // Send alert
        await req.alert('success', 'Successfully logged in', {
          'save' : true
        });

        // Hook user login
        await this.eden.emit('user.login', {
          'req'  : req,
          'user' : user
        });

        // Redirect to home
        res.redirect((req.query || {}).redirect || req.body.redirect || '/');
      });
    })(req, res, next);
  }

  /**
   * Forgot password action
   *
   * @param {Request}  req}
   * @param {Response} res}
   *
   * @acl   false
   * @fail  /
   * @title Forgot Password
   * @route {get} /forgot
   *
   * @return {*}
   */
  async forgotAction (req, res) {
    // Check if token
    if (req.query.token) {
      // Load user
      let user = await User.findOne({
        'token' : req.query.token
      });

      // Check user
      if (!user) {
        // Send alert
        req.alert('error', 'The token you have sent is invalid');

        // Render forgot
        return res.render('forgot');
      }

      // Render reset
      return res.render('reset', {
        'token' : user.get('token')
      });
    }

    // Render login page
    res.render('forgot');
  }

  /**
   * Reset password action
   *
   * @param {Request}  req
   * @param {Response} res
   *
   * @acl   false
   * @fail  /
   * @title Reset Password
   * @route {post} /reset
   *
   * @return {*}
   */
  async resetSubmitAction (req, res) {
    // Check if token
    if (!req.body.token) return res.redirect('/forgot');

    // Load user
    let user = await User.findOne({
      'token' : req.body.token
    });

    // Check user
    if (!user) {
      // Send alert
      req.alert('error', 'The token you have used is invalid');

      // Redirect
      return res.redirect('/forgot');
    }

    // Set password
    if (req.body.password.trim().length < 5) {
      // Send alert
      req.alert('error', 'Your password must be at least 5 characters long');

      // Render registration page
      return res.render('reset', {
        'token' : req.body.token
      });
    }

    // Check passwords match
    if (req.body.password !== req.body.passwordb) {
      // Send alert
      req.alert('error', 'Your passwords do not match');

      // Render registration page
      return res.render('reset', {
        'token' : req.body.token
      });
    }

    // Everything checks out
    let hash = crypto.createHmac('sha256', config.get('secret'))
      .update(req.body.password)
      .digest('hex');

    // Create user
    user.set('hash', hash);

    // Save user
    await user.save();

    // Send alert
    req.alert('success', 'Successfully updated your password');

    // Redirect to login
    res.redirect('/login');
  }

  /**
   * Login form action
   *
   * @param {Request} req
   * @param {Response} res
   *
   * @returns {*}
   *
   * @acl   false
   * @fail  /
   * @title Forgot Password
   * @route {post} /forgot
   */
  async forgotSubmitAction (req, res) {
    // Load user
    let user = await User.or({
      'email' : new RegExp(['^', escapeRegex(req.body.username.toLowerCase()), '$'].join(''), 'i')
    }, {
      'username' : new RegExp(['^', escapeRegex(req.body.username.toLowerCase()), '$'].join(''), 'i')
    }).findOne();

    // Check user exists
    if (!user) {
      // Send error
      req.alert('error', 'Username not found');

      // Redirect
      return this.forgotAction(req, res);
    }

    // Check email
    if (!user.get('email')) {
      // Send alert
      return req.alert('error', 'User does not have an email');
    }

    // Set token
    user.set('token', crypto.randomBytes(Math.ceil(24 / 2)).toString('hex').slice(0, 24));

    // Save user
    await user.save();

    // Alert
    req.alert('success', 'An email has been sent with your password reset token');

    // Send email
    EmailHelper.send(user.get('email') || user.get('username'), 'forgot', {
      'token'   : user.get('token'),
      'subject' : config.get('domain') + ' - forgot password'
    });

    // Return redirect
    return res.redirect('/');
  }

  /**
   * Logout action
   *
   * @param req
   * @param res
   *
   * @acl      true
   * @fail     /
   * @menu     {MAIN} Logout
   * @route    {get} /logout
   * @priority 2
   */
  async logoutAction (req, res) {
    // Hook user login
    await this.eden.emit('user.logout', {
      'req'  : req,
      'user' : req.user
    });

    // Logout
    req.logout();

    // Emit to socket
    socket.session(req.sessionID, 'user', false);

    // Send alert
    await req.alert('success', 'Successfully logged out', {
      'save' : true
    });

    // Redirect to home
    res.redirect('/');
  }

  /**
   * Register action
   *
   * @param req
   * @param res
   *
   * @acl   false
   * @fail  /
   * @title Register
   * @route {get} /register
   */
  registerAction (req, res) {
    // Render registration page
    res.render('register', {
      'redirect' : req.query.redirect || false
    });
  }

  /**
   * Register form action
   *
   * @param req
   * @param res
   *
   * @acl   false
   * @fail  /
   * @title Register
   * @route {post} /register
   */
  async registerSubmitAction (req, res) {
    // Create user
    let user = new User();

    // Check username
    if (req.body.username.trim().length < 5) {
      // Send alert
      req.alert('error', 'your username must be at least 5 characters long');

      // Render registration page
      return res.render('register', {
        'old'      : req.body,
        'redirect' : req.query.redirect || req.body.redirect || false
      });
    }

    // Check email
    if (req.body.email && req.body.email.length) {
      // Check email
      let email = await User.findOne({
        'email' : new RegExp(['^', escapeRegex(req.body.email), '$'].join(''), 'i')
      });

      // If Email
      if (email) {
        // Send alert
        req.alert('error', 'the email "' + req.body.email + '" is already taken');

        // Render registration page
        return res.render('register', {
          'old'      : req.body,
          'redirect' : req.query.redirect || req.body.redirect || false
        });
      }

      // Set email
      user.set('email', req.body.email);
    }

    // Check for user
    let username = await User.findOne({
      'username' : new RegExp(['^', escapeRegex(req.body.username), '$'].join(''), 'i')
    });

    // Check if user exists
    if (username) {
      // Send alert
      req.alert('error', 'the username "' + req.body.username + '" is already taken');

      // Render registration page
      return res.render('register', {
        'old'      : req.body,
        'redirect' : req.query.redirect || req.body.redirect || false
      });
    }

    // Set email
    user.set('username', req.body.username);

    // Check password length
    if (req.body.password.trim().length < 5) {
      // Send alert
      req.alert('error', 'your password must be at least 5 characters long');

      // Render registration page
      return res.render('register', {
        'old'      : req.body,
        'redirect' : req.query.redirect || req.body.redirect || false
      });
    }

    // Check passwords match
    if (req.body.password !== req.body.passwordb) {
      // Send alert
      req.alert('error', 'your passwords do not match');

      // Render registration page
      return res.render('register', {
        'old'      : req.body,
        'redirect' : req.query.redirect || req.body.redirect || false
      });
    }

    // Everything checks out
    let hash = crypto.createHmac('sha256', config.get('secret'))
      .update(req.body.password)
      .digest('hex');

    // Set hash
    user.set('hash', hash);

    // Let prevented
    let prevented = false;

    // Hook user login
    await this.eden.hook('user.register', {
      'req'  : req,
      'user' : user
    }, async (obj) => {
      // Check error
      if (obj.error) {
        // Set prevented
        prevented = true;

        // Render
        return res.render('register', {
          'old'      : req.body,
          'redirect' : req.query.redirect || req.body.redirect || false
        });
      }

      // Save user
      await user.save();
    });

    // Log user in
    if (!prevented) req.login(user, async () => {
      // Send alert
      await req.alert('success', 'You are now successfully registered', {
        'save' : true
      });

      // Hook user login
      await this.eden.emit('user.login', {
        'req'  : req,
        'user' : user
      });

      // Emit to socket
      socket.session(req.sessionID, 'user', await user.sanitise());

      // Redirect to home
      res.redirect(req.query.redirect || req.body.redirect || '/');
    });
  }

  /**
   * Adds user to locals
   *
   * @param {Request} req
   * @param {Response} res
   * @param {Function} next
   */
  async _user (req, res, next) {
    // Set user locally
    res.locals.acl  = await AclHelper.list(req.user);
    res.locals.user = req.user ? await req.user.sanitise() : false;

    // Run next
    next();
  }

  /**
   * Checks acl exists
   */
  async _acl () {
    // Create test array
    let acls = (config.get('acl.default') || []).slice(0);

    // Check if array
    if (!Array.isArray(acls)) acls = [acls];

    // Push admin Acls
    acls.push(...(config.get('acl.admin') || []).slice(0));

    // Check acls
    for (let i = 0; i < acls.length; i++) {
      // Load acl
      let check = await Acl.count({
        'name' : acls[i].name
      });

      // Creat if not exists
      if (!check) {
        // Set create
        let create = new Acl(acls[i]);

        // Save
        await create.save();
      }
    }
  }

  /**
   * On user login
   *
   * @param {Object} obj
   */
  async _login (obj) {
    // Add to login
    let login = new Login({
      'ip'      : obj.req ? obj.req.headers['x-forwarded-for'] || obj.req.connection.remoteAddress.replace(/^.*:/, '') : false,
      'way'     : 'login',
      'fail'    : !!obj.fail,
      'user'    : obj.user,
      'message' : obj.message
    });

    // Save login
    await login.save();
  }

  /**
   * On user login
   *
   * @param {Object} obj
   */
  async _register (obj) {
    // Load user
    let def  = (config.get('acl.default') || []).slice(0);
    let acls = [];
    let user = obj.user;

    // Set as array
    if (!Array.isArray(def)) def = [def];

    // Check acls
    let count = await User.count();

    // Add admin roles
    if (count === 0) {
      def.push(...(config.get('acl.admin') || []).slice(0));
    }

    // Load acls
    for (let i = 0; i < def.length; i++) {
      // Load acl
      let check = await Acl.findOne({
        'name' : def[i].name
      });

      // Check check
      if (check) acls.push(check);
    }

    // Set acls
    user.set('acl', acls);
  }

  /**
   * On user login
   *
   * @param {Object} obj
   */
  async _logout (obj) {
    // Add to login
    let login = new Login({
      'ip'      : obj.req ? obj.req.headers['x-forwarded-for'] || obj.req.connection.remoteAddress : false,
      'way'     : 'logout',
      'fail'    : false,
      'user'    : obj.user,
      'message' : false
    });

    // Save login
    await login.save();
  }

  /**
   * Authenticate user function
   *
   * @param {String}   username
   * @param {String}   password
   * @param {Function} done
   *
   * @returns {*}
   */
  async _authenticate (username, password, done) {
    // Find user
    let user = await User.match('username', new RegExp(['^', escapeRegex(username), '$'].join(''), 'i')).findOne() ||
               await User.match('email', new RegExp(['^', escapeRegex(username), '$'].join(''), 'i')).findOne();

    // Check user exists
    if (!user) {
      // Return done
      return done(null, false, {
        'user'    : false,
        'message' : 'User not found'
      });
    }

    // Authenticate
    let result = await user.authenticate(password);

    // Check error
    if (result !== true) {
      return done(null, false, {
        'user'    : user,
        'message' : result.info
      });
    }

    // Send done
    done(null, user);
  }

  /**
   * Deserialize user
   *
   * @param {String} id
   * @param {Function} done
   */
  async _deserialise (id, done) {
    console.log(id, done);
    // Find user by id
    let user = await User.findById(id);

    // Callback done with user
    done(null, user);
  }
}

/**
 * Eport user controller
 *
 * @type {UserController}
 */
exports = module.exports = UserController;


// Bind dependencies
const Grid        = require('grid');
const alert       = require('alert');
const config      = require('config');
const Controller  = require('controller');
const escapeRegex = require('escape-string-regexp');

// Require models
const Acl   = model('acl');
const User  = model('user');
const Block = model('block');

// require helpers
const formHelper = helper('form');

/**
 * Build user admin controller
 *
 * @acl   admin.users.view
 * @fail  /
 * @mount /admin/user
 */
class AdminUserController extends Controller {
  /**
   * Construct user admin controller
   */
  constructor() {
    // Run super
    super();

    // bind build method
    this.build = this.build.bind(this);

    // Bind methods
    this.gridAction = this.gridAction.bind(this);
    this.indexAction = this.indexAction.bind(this);
    this.createAction = this.createAction.bind(this);
    this.updateAction = this.updateAction.bind(this);
    this.removeAction = this.removeAction.bind(this);
    this.createSubmitAction = this.createSubmitAction.bind(this);
    this.updateSubmitAction = this.updateSubmitAction.bind(this);
    this.removeSubmitAction = this.removeSubmitAction.bind(this);

    // Bind private methods
    this._grid = this._grid.bind(this);

    // build
    this.building = this.build();
  }

  /**
   * builds edenjs user
   */
  build() {
    
  }

  /**
   * Index action
   *
   * @param {Request}  req
   * @param {Response} res
   *
   * @icon    fa fa-user
   * @menu    {ADMIN} Users
   * @title   User Administration
   * @route   {get} /
   * @parent  /admin/config
   * @layout  admin
   */
  async indexAction(req, res) {
    // Render grid
    res.render('user/admin', {
      grid : await (await this._grid(req)).render(req),
    });
  }

  /**
   * index action
   *
   * @param req
   * @param res
   *
   * @acl   admin
   * @fail  next
   * @route {GET} /query
   */
  async queryAction(req, res) {
    // find children
    let users = await User;

    // set query
    if (req.query.q) {
      users = users.or({
        name : new RegExp(escapeRegex(req.query.q || ''), 'i'),
      }, {
        email : new RegExp(escapeRegex(req.query.q || ''), 'i'),
      }, {
        username : new RegExp(escapeRegex(req.query.q || ''), 'i'),
      });
    }

    // add roles
    users = await users.skip(((parseInt(req.query.page, 10) || 1) - 1) * 20).limit(20).sort('name', 1)
      .find();

    // get children
    res.json((await Promise.all(users.map(user => user.sanitise()))).map((sanitised) => {
      // return object
      return {
        text  : sanitised.name || sanitised.username || sanitised.email,
        data  : sanitised,
        value : sanitised.id,
      };
    }));
  }

  /**
   * index action
   *
   * @param req
   * @param res
   *
   * @acl   admin
   * @fail  next
   * @route {GET} /role/query
   */
  async queryRoleAction(req, res) {
    // find children
    let roles = await Acl;

    // set query
    if (req.query.q) {
      roles = roles.where({
        name : new RegExp(escapeRegex(req.query.q || ''), 'i'),
      });
    }

    // add roles
    roles = await roles.skip(((parseInt(req.query.page, 10) || 1) - 1) * 20).limit(20).sort('name', 1)
      .find();

    // get children
    res.json((await Promise.all(roles.map(role => role.sanitise()))).map((sanitised) => {
      // return object
      return {
        text  : sanitised.name,
        data  : sanitised,
        value : sanitised.id,
      };
    }));
  }

  /**
   * Add/edit action
   *
   * @param {Request}  req
   * @param {Response} res
   * @return *
   *
   * @route    {get} /create
   * @route    {get} /:id/edit
   * @menu     {USERS} Add User
   * @layout   admin
   * @priority 12
   */
  createAction(req, res) {
    // Return update action
    return this.updateAction(req, res);
  }

  /**
   * Update action
   *
   * @param {Request}  req
   * @param {Response} res
   *
   * @route   {get} /:id/update
   * @layout  admin
   */
  async updateAction(req, res) {
    // Set website variable
    let user   = new User();
    let create = true;

    // Check for website model
    if (req.params.id) {
      // Load user
      user = await User.findById(req.params.id);
      create = false;
    }

    // get form
    const form = await formHelper.get('edenjs.user');

    // digest into form
    const sanitised = await formHelper.render(req, form, await Promise.all(form.get('fields').map(async (field) => {
      // return fields map
      return {
        uuid  : field.uuid,
        value : await user.get(field.name || field.uuid),
      };
    })));

    // get form
    if (!form.get('_id')) res.form('edenjs.user');

    // Render page
    res.render('user/admin/update', {
      item   : await user.sanitise(),
      form   : sanitised,
      title  : create ? 'Create New' : `Update ${user.get('username') || user.get('email')}`,
      fields : config.get('user.fields').map((field) => {
        // clone field
        field = JSON.parse(JSON.stringify(field));

        // delete field stuff
        delete field.format;
        delete field.filter;

        // return field
        return field;
      }),
    });
  }

  /**
   * Login as user
   *
   * @param  {Request}  req
   * @param  {Response} res
   *
   * @route   {get} /:id/login
   * @return {Promise}
   */
  async loginAsAction(req, res) {
    // Set website variable
    const user = await User.findById(req.params.id);

    // Login as user
    req.login(user, () => {
      // Redirect
      res.redirect('/');
    });
  }

  /**
   * Create submit action
   *
   * @param  {Response} req
   * @param  {Request}  res
   * @return *
   *
   * @route   {post} /create
   * @layout  admin
   */
  createSubmitAction(req, res) {
    // Return update action
    return this.updateSubmitAction(req, res);
  }

  /**
   * Add/edit action
   *
   * @param {Request}  req
   * @param {Response} res
   * @param {Function} next
   *
   * @route   {post} /:id/update
   * @layout  admin
   */
  async updateSubmitAction(req, res, next) {
    // Set website variable
    let user   = new User();
    let create = true;

    // Check for website model
    if (req.params.id) {
      // Load by id
      user = await User.findById(req.params.id);
      create = false;
    }

    // get form
    const form = await formHelper.get('edenjs.user');

    // digest into form
    const fields = await formHelper.submit(req, form, await Promise.all(form.get('fields').map(async (field) => {
      // return fields map
      return {
        uuid  : field.uuid,
        value : await user.get(field.name || field.uuid),
      };
    })));

    // loop fields
    for (const field of fields) {
      // set value
      user.set(field.name || field.uuid, field.value);
    }

    // Update user
    req.alert('success', `Successfully ${create ? 'created' : 'updated'} user`);

    // Save audit
    await user.save(req.user);

    // get user
    req.params.id = user.get('_id').toString();

    // Render page
    return this.updateAction(req, res, next);
  }

  /**
   * Delete action
   *
   * @param {Request}  req
   * @param {Response} res
   *
   * @route   {get} /:id/remove
   * @layout  admin
   */
  async removeAction(req, res) {
    // Set website variable
    let user = false;

    // Check for website model
    if (req.params.id) {
      // Load user
      user = await User.findById(req.params.id);
    }

    // Render page
    res.render('user/admin/remove', {
      item  : await user.sanitise(),
      title : `Remove ${user.get('username') || user.get('email')}`,
    });
  }

  /**
   * Delete action
   *
   * @param {Request}  req
   * @param {Response} res
   *
   * @route   {post} /:id/remove
   * @title   User Administration
   * @layout  admin
   */
  async removeSubmitAction(req, res) {
    // Set website variable
    let user = false;

    // Check for website model
    if (req.params.id) {
      // Load user
      user = await User.findById(req.params.id);
    }

    // Alert Removed
    req.alert('success', `Successfully removed ${user.get('username') || user.get('email')}`);

    // Delete website
    await user.remove(req.user);

    // Render index
    return this.indexAction(req, res);
  }

  /**
   * User alert emit
   *
   * @param {Object} data
   * @param {Object} opts
   *
   * @socket user.alert
   */
  async alertSocket(data, opts) {
    // Alert user
    alert.user(await User.findById(data.id), data.type, data.text);

    // Alert socket
    opts.alert('success', 'successfully sent alert');
  }

  /**
   * User grid action
   *
   * @param {Request}  req
   * @param {Response} res
   *
   * @route {get}  /grid
   * @route {post} /grid
   *
   * @returns {Promise}
   */
  async gridAction(req, res) {
    // Return post grid request
    return (await this._grid(req)).post(req, res);
  }

  /**
   * Renders grid
   *
   * @return {grid}
   */
  async _grid(req) {
    // Create new grid
    const userGrid = new Grid();

    // Set route
    userGrid.route('/admin/user/grid');

    // get form
    const form = await formHelper.get('edenjs.user');

    // Set grid model
    userGrid.id('admin.user');
    userGrid.model(User);
    userGrid.models(true);

    // Add grid columns
    userGrid.column('_id', {
      sort     : true,
      title    : 'Id',
      priority : 100,
    });

    // branch fields
    await Promise.all((form.get('_id') ? form.get('fields') : config.get('user.fields').slice(0)).map(async (field, i) => {
      // set found
      const found = config.get('user.fields').find(f => f.name === field.name);

      // add config field
      await formHelper.column(req, form, userGrid, field, {
        hidden   : !(found && found.grid),
        priority : 100 - i,
      });
    }));

    // add extra columns
    userGrid.column('updated_at', {
      tag      : 'grid-date',
      sort     : true,
      title    : 'Updated',
      priority : 4,
    }).column('created_at', {
      tag      : 'grid-date',
      sort     : true,
      title    : 'Created',
      priority : 3,
    }).column('actions', {
      tag      : 'user-actions',
      type     : false,
      width    : '1%',
      title    : 'Actions',
      priority : 0,
    });

    // branch filters
    config.get('user.fields').slice(0).filter(field => field.grid).forEach((field) => {
      // add config field
      userGrid.filter(field.name, {
        type  : 'text',
        title : field.label,
        query : (param) => {
          // Another where
          userGrid.match(field.name, new RegExp(escapeRegex(param.toString().toLowerCase()), 'i'));
        },
      });
    });

    // Set default sort order
    userGrid.sort('created_at', 1);

    // return user grid
    return userGrid;
  }
}

/**
 * Export admin controller
 *
 * @type {admin}
 */
module.exports = AdminUserController;

// create config object
const config = {};

// default company config
config.user = {
  fields : [
    {
      name  : 'avatar',
      type  : 'image',
      label : 'Avatar',
    },
    {
      name  : 'email',
      grid  : true,
      type  : 'email',
      label : 'Email',
    },
    {
      name  : 'username',
      grid  : true,
      type  : 'text',
      label : 'Username',
    },
    {
      name  : 'hash',
      type  : 'encrypt',
      label : 'Password',
    },
    {
      name     : 'acl',
      type     : 'admin.role',
      label    : 'Roles',
      multiple : true,
    },
  ],
};

// export config
module.exports = config;

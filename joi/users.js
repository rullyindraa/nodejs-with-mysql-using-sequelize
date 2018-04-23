const joi = require('joi');

module.exports = joi.object().keys({
  username: joi.string().alphanum().min(3).max(25).error(new Error('invalid username')).required(),
  email: joi.string().email().error(new Error('invalid email')).required(),
  password: joi.string().error(new Error('invalid password')).regex(/^[a-zA-Z0-9]{3,30}$/)
})
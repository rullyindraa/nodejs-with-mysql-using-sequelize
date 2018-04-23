module.exports = function(sequelize, Sequelize) {
  var User = sequelize.define('user', {
    id: {
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER
    },
    username: {
      type: Sequelize.STRING,
      notEmpty: true
    },
    email: {
      type: Sequelize.STRING,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: Sequelize.STRING,
      allowNull: true
    },
    twofa:{
      type: Sequelize.ENUM('enable', 'disable'),
      allowNull: true
    },
    twofa_secret:{
      type: Sequelize.STRING,
      allowNull: true
    },
    qr_url:{
      type: Sequelize.STRING,
      allowNull: true
    },
    email_token: {
      type: Sequelize.STRING
    },
    token_exp: {
      type: Sequelize.DATE
    }
  });
  return User;
}
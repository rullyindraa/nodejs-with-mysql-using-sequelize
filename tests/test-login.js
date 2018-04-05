var expect = require('chai').expect;
var app = require('../app');
var request = require('supertest');

describe('GET /students', function(done){
  const userCredentials = {
    username: 'rully',
    password: '12345'
  }
  var authenticatedUser = request.agent(app);
  before(function(done){
    authenticatedUser
      .post('/login')
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(userCredentials)
      .expect(200)
      .end(function(err, response){
        expect('Location', '/');
        done();
      });
  });
  it('should return a 200 response if the user is logged in', function(done){
    authenticatedUser.get('/students')
    .expect(200, done)
  });
  it('should return a 302 response and redirect to /login', function(done){
    request(app).get('/students')
    .expect('Location', '/login')
    .expect(302, done);
  });
});

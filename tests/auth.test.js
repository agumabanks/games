// tests/auth.test.js - Authentication Tests
const request = require('supertest');
const app = require('../backend/server');
const User = require('../backend/models/User');

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    test('Should register a new user', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.username).toBe(userData.username);

      // Verify user was created in database
      const user = await User.findOne({ email: userData.email });
      expect(user).toBeTruthy();
    });

    test('Should not register user with existing email', async () => {
      // Create user first
      await User.create({
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newuser',
          email: 'existing@example.com',
          password: 'password123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Email already registered');
    });
  });

  describe('POST /api/auth/login', () => {
    test('Should login with valid credentials', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.user.id).toBe(user._id.toString());
    });

    test('Should not login with invalid credentials', async () => {
      await User.create({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid email or password');
    });
  });
});
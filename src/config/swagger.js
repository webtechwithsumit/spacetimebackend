const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Spacetime API',
      version: '1.0.0',
      description: 'Spacetime API — user APIs',
    },
    servers: [
      { url: 'http://localhost:3002' },
    ],
    tags: [
      { name: 'Auth', description: 'Register and login' },
      { name: 'Profile', description: 'Logged-in user profile' },
      { name: 'Health', description: 'Server health check' },
      { name: 'Users', description: 'User CRUD operations' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            name: { type: 'string', example: 'Rahul' },
            email: { type: 'string', example: 'rahul@example.com' },
            phone: { type: 'string', example: '9876543210' },
            role: {
              type: 'string',
              enum: ['Buyer', 'Seller', 'Broker', 'Admin', 'Super-Admin'],
              example: 'Buyer',
            },
            image: { type: 'string', example: 'https://example.com/avatar.jpg' },
            aadharNo: { type: 'string', example: '123456789012' },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, '../routes/*.js')],
};

module.exports = swaggerJsdoc(options);

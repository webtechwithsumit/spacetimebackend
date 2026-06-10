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
      { name: 'Health', description: 'Server health check' },
      { name: 'Users', description: 'User CRUD operations' },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '1' },
            name: { type: 'string', example: 'Rahul' },
            email: { type: 'string', example: 'rahul@example.com' },
          },
        },
      },
    },
  },
  apis: [path.join(__dirname, '../routes/*.js')],
};

module.exports = swaggerJsdoc(options);

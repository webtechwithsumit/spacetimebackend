const path = require('path');
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Spacetime API',
      version: '1.0.0',
      description:
        'Spacetime backend API — Auth, Profile, Users, Properties, Live Auctions, Bids, Blog, Community, Support Tickets, Dashboard, and Analytics.',
    },
    servers: [
      { url: 'http://localhost:3002' },
    ],
    tags: [
      { name: 'Health', description: 'Server health check' },
      { name: 'Auth', description: 'Register and login' },
      { name: 'Profile', description: 'Logged-in user profile' },
      { name: 'Users', description: 'User management (Admin / Super-Admin)' },
      { name: 'Properties', description: 'Property CRUD and live auction listings' },
      { name: 'Bids', description: 'Place bids on live auction properties' },
      { name: 'Dashboard', description: 'Role-based dashboard overview' },
      { name: 'Blog', description: 'Public blog posts and admin CMS' },
      { name: 'Community', description: 'Community discussions and moderation' },
      { name: 'Support', description: 'User support tickets and admin help desk' },
      { name: 'Analytics', description: 'Platform analytics plugin (when ANALYTICS_ENABLED=true)' },
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
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 10 },
            total: { type: 'integer', example: 42 },
            totalPages: { type: 'integer', example: 5 },
          },
        },
        PlaceBidRequest: {
          type: 'object',
          required: ['amount'],
          properties: {
            amount: {
              oneOf: [{ type: 'number' }, { type: 'string' }],
              example: 77500000,
              description: 'Bid amount in rupees (number or formatted string)',
            },
          },
        },
      },
      parameters: {
        PageParam: {
          in: 'query',
          name: 'page',
          schema: { type: 'integer', minimum: 1, default: 1 },
          description: 'Page number for pagination',
        },
        LimitParam: {
          in: 'query',
          name: 'limit',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          description: 'Items per page (max 100)',
        },
        PropertyIdParam: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'Property MongoDB ObjectId',
        },
        UserIdParam: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'User MongoDB ObjectId',
        },
        TicketIdParam: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'Support ticket MongoDB ObjectId',
        },
        PostIdParam: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'Community post MongoDB ObjectId',
        },
        BlogSlugParam: {
          in: 'path',
          name: 'slug',
          required: true,
          schema: { type: 'string' },
          description: 'Blog post URL slug',
        },
      },
    },
  },
  apis: [
    path.join(__dirname, '../routes/*.js'),
    path.join(__dirname, '../plugins/analytics/routes/*.js'),
  ],
};

module.exports = swaggerJsdoc(options);

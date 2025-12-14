const fs = require('fs');
const path = require('path');
const { specs } = require('/config/swagger');
const openApiSpec = JSON.stringify(specs, null, 2);
fs.writeFileSync(path.join(__dirname, 'openapi-spec.json'), openApiSpec);
const readmeContent = `# Learning Platform API Documentation

## API Documentation

Interactive API documentation available at: http://localhost:3000/api-docs

## Authentication

Most endpoints require JWT authentication. Include token in Authorization header:

\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

## Endpoints

### Authentication
- \`POST /api/auth/register\` - User registration
- \`POST /api/auth/login\` - User login  
- \`GET /api/auth/verify\` - Token verification

### Skycharts
- \`POST /api/skycharts\` - Create skychart
- \`GET /api/skycharts/my\` - Get user's skycharts
- \`GET /api/skycharts/public\` - Get public skycharts
- \`GET /api/skycharts/{id}\` - Get specific skychart
- \`DELETE /api/skycharts/{id}\` - Delete skychart

### Chats
- \`GET /api/chats\` - Get user chats
- \`POST /api/chats\` - Create chat
- \`GET /api/chats/{id}/messages\` - Get chat messages
- \`POST /api/chats/{id}/messages\` - Send message

## Database Schema

See [database-schema.md](./database-schema.md) for detailed database documentation.

## Testing

Run tests: \`npm test\`

## Development

Start development server: \`npm run dev\`

---

*Documentation generated automatically* 
`;

fs.writeFileSync(path.join(__dirname, '../README.md'), readmeContent);
console.log('Documentation generated successfully!');
console.log('http://localhost:3000/api-docs');
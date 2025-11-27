const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Learning Platform API',
      version: '1.0.0',
      description: 'API для образовательной платформы с системой скайчартов и чатов',
      contact: {
        name: 'API Support',
        email: 'support@learningplatform.com'
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'User ID'
            },
            email: {
              type: 'string',
              description: 'User email'
            },
            username: {
              type: 'string',
              description: 'Username'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Skychart: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              description: 'Skychart ID'
            },
            title: {
              type: 'string',
              description: 'Skychart title'
            },
            user_id: {
              type: 'integer',
              description: 'Owner user ID'
            },
            is_public: {
              type: 'boolean',
              description: 'Is skychart public'
            },
            image_url: {
              type: 'string',
              description: 'Image URL'
            },
            created_at: {
              type: 'string',
              format: 'date-time'
            },
            points: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/SkychartPoint'
              }
            }
          }
        },
        SkychartPoint: {
          type: 'object',
          properties: {
            id: {
              type: 'integer'
            },
            name: {
              type: 'string'
            },
            x: {
              type: 'number',
              format: 'float'
            },
            y: {
              type: 'number',
              format: 'float'
            },
            radius: {
              type: 'number',
              format: 'float'
            }
          }
        },
        Chat: {
            type: 'object',
            properties: {
                id: {
                type: 'string',
                description: 'ID чата (для избранного - с префиксом favorite_)'
                },
                type: {
                type: 'string',
                enum: ['user', 'favorite'],
                description: 'Тип чата'
                },
                other_user: {
                $ref: '#/components/schemas/User',
                description: 'Другой пользователь в чате (только для type: user)'
                },
                created_at: {
                type: 'string',
                format: 'date-time'
                },
                last_message: {
                type: 'string',
                description: 'Текст последнего сообщения'
                },
                last_message_time: {
                type: 'string',
                format: 'date-time',
                description: 'Время последнего сообщения'
                }
            }
        },
        Message: {
            type: 'object',
            required: ['id', 'sender_id', 'content', 'created_at'],
            properties: {
                id: {
                type: 'integer',
                description: 'ID сообщения'
                },
                sender_id: {
                type: 'integer',
                description: 'ID отправителя'
                },
                content: {
                type: 'string',
                description: 'Текст сообщения'
                },
                created_at: {
                type: 'string',
                format: 'date-time',
                description: 'Время отправки'
                },
                is_read: {
                type: 'boolean',
                description: 'Прочитано ли сообщение'
                },
                sender_username: {
                type: 'string',
                description: 'Имя отправителя'
                }
            }
        },
        UserSearchResult: {
            type: 'object',
            properties: {
                id: {
                type: 'integer',
                description: 'ID пользователя'
                },
                email: {
                type: 'string',
                format: 'email'
                },
                username: {
                type: 'string'
                }
            }
        },
        CheckResult: {
            type: 'object',
            properties: {
                correct: {
                type: 'integer',
                description: 'Количество правильных размещений'
                },
                incorrect: {
                type: 'integer',
                description: 'Количество неправильных размещений'
                },
                total: {
                type: 'integer',
                description: 'Общее количество точек'
                },
                score: {
                type: 'integer',
                description: 'Процент правильных ответов (0-100)'
                },
                placements: {
                type: 'object',
                additionalProperties: {
                    type: 'object',
                    properties: {
                    correct: {
                        type: 'boolean',
                        description: 'Правильно ли размещена точка'
                    },
                    userX: {
                        type: 'number',
                        format: 'float'
                    },
                    userY: {
                        type: 'number',
                        format: 'float'
                    },
                    actualX: {
                        type: 'number',
                        format: 'float'
                    },
                    actualY: {
                        type: 'number',
                        format: 'float'
                    },
                    distance: {
                        type: 'number',
                        format: 'float',
                        description: 'Расстояние между размещенной и реальной точкой'
                    }
                }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = {
  specs,
  swaggerUi
};
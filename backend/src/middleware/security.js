const helmet = require('helmet');
const cors = require('cors');
const env = require('../config/env');

const corsOptions = {
  origin: env.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
};

const helmetOptions = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      styleSrc: ["'self'"],
      scriptSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  // 'cross-origin' porque o frontend e o backend costumam ficar em
  // domínios diferentes; 'same-site' bloquearia as respostas da API.
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: { maxAge: 15552000, includeSubDomains: true },
});

module.exports = { cors: cors(corsOptions), helmet: helmetOptions };

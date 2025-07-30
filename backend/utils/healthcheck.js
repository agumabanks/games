const http = require('http');

const port = process.env.PORT || 5000;
const options = {
  host: 'localhost',
  port,
  path: '/health',
  timeout: 2000,
};

const req = http.get(options, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    console.error(`Healthcheck failed with status: ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (err) => {
  console.error('Healthcheck error:', err.message);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Healthcheck timed out');
  req.destroy();
  process.exit(1);
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

// 加载环境变量
const envPath = path.join(__dirname, '../config.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value && !key.startsWith('#')) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 路由
app.use('/api/chat', require('./routes/chat'));
app.use('/api/professors', require('./routes/professors'));
app.use('/api/matching', require('./routes/matching'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'ZJU Research Matching Agent is running' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Network access: http://172.25.155.42:${PORT}/api/health`);
  console.log(`For mobile testing, use: http://172.25.155.42:${PORT}/api`);
});
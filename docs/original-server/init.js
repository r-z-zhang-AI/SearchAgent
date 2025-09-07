const { initializeDatabase } = require('./services/professorService');

async function init() {
  try {
    console.log('正在初始化数据库...');
    await initializeDatabase();
    console.log('数据库初始化完成！');
    console.log('现在可以启动服务器了：npm run server');
  } catch (error) {
    console.error('数据库初始化失败:', error);
  }
}

init();
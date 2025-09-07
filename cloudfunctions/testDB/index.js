const tcb = require('@cloudbase/node-sdk');

exports.main = async (event, context) => {
  try {
    console.log('开始测试数据库连接和数据结构...');

    // 初始化
    const app = tcb.init();
    const db = app.database();

    // 1. 测试数据库连接
    console.log('测试数据库连接...');
    const collections = await db.listCollections();
    console.log('数据库中的集合:', collections.map(c => c.CollectionName));

    // 2. 查询professors集合的总数
    const count = await db.collection('professors').count();
    console.log('professors集合总数:', count.total);

    // 3. 获取前3条数据查看结构
    const sampleData = await db.collection('professors').limit(3).get();
    console.log('前3条数据:');
    sampleData.data.forEach((item, index) => {
      console.log(`第${index + 1}条数据:`, JSON.stringify(item, null, 2));
    });

    // 4. 检查字段分布
    if (sampleData.data.length > 0) {
      const firstRecord = sampleData.data[0];
      console.log('第一条记录的字段:', Object.keys(firstRecord));
      
      // 检查关键字段
      const keyFields = ['教师姓名', '中文名', '院系', '研究方向', '职称', '邮箱'];
      keyFields.forEach(field => {
        console.log(`字段 "${field}":`, firstRecord[field]);
      });
    }

    // 5. 测试查询条件
    const testQuery = await db.collection('professors')
      .where({
        '研究方向': db.command.like('人工智能')
      })
      .limit(3)
      .get();
    console.log('包含"人工智能"的教授数量:', testQuery.data.length);

    return {
      success: true,
      totalCount: count.total,
      sampleDataCount: sampleData.data.length,
      collections: collections.map(c => c.CollectionName),
      aiProfessorsCount: testQuery.data.length,
      sampleFields: sampleData.data.length > 0 ? Object.keys(sampleData.data[0]) : []
    };

  } catch (error) {
    console.error('测试失败:', error);
    return {
      success: false,
      error: error.toString()
    };
  }
};

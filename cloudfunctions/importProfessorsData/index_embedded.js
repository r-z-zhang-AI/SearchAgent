const tcb = require('@cloudbase/node-sdk');

// 嵌入的教授数据（从professors_data.json提取）
const PROFESSORS_DATA = require('./professors_data.json');

// 云函数主体 - 使用嵌入的JSON数据
exports.main = async (event, context) => {
  try {
    console.log('开始导入嵌入的教授数据...');

    // 初始化
    const app = tcb.init();
    const db = app.database();
    
    const professorsData = PROFESSORS_DATA;
    console.log(`从嵌入数据中读取到 ${professorsData.length} 条教授数据`);

    // 1. 清空现有数据（可选）
    try {
      // 先查询是否有数据
      const existingCount = await db.collection('professors').count();
      console.log(`数据库中现有 ${existingCount.total} 条数据`);
      
      if (existingCount.total > 0) {
        // 分批删除数据（云数据库有单次操作限制）
        const batchSize = 20;
        let totalDeleted = 0;
        
        while (totalDeleted < existingCount.total) {
          const deleteResult = await db.collection('professors').limit(batchSize).remove();
          totalDeleted += deleteResult.deleted;
          console.log(`已删除 ${totalDeleted}/${existingCount.total} 条数据`);
        }
        console.log('清空现有数据完成');
      }
    } catch (deleteError) {
      console.log('清空数据失败:', deleteError.toString());
    }

    // 2. 插入数据
    let successCount = 0;
    const batchSize = 20; // 云数据库批量插入限制
    
    for (let i = 0; i < professorsData.length; i += batchSize) {
      const batch = professorsData.slice(i, i + batchSize);
      
      try {
        const processedBatch = batch.map(professor => {
          // 过滤空值
          const cleanedData = {};
          Object.keys(professor).forEach(key => {
            if (professor[key] && professor[key].toString().trim() !== '') {
              cleanedData[key] = professor[key];
            }
          });

          // 添加时间戳和唯一ID
          cleanedData.importTime = new Date();
          cleanedData.id = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          return cleanedData;
        });

        // 批量插入
        const insertResult = await db.collection('professors').add(processedBatch);
        successCount += processedBatch.length;
        console.log(`成功插入第 ${i + 1}-${Math.min(i + batchSize, professorsData.length)} 条数据`);
      } catch (insertError) {
        console.error(`插入第 ${i + 1}-${Math.min(i + batchSize, professorsData.length)} 条数据失败:`, insertError);
      }
    }

    // 3. 验证插入结果
    const finalCount = await db.collection('professors').count();
    console.log(`数据库中现有教授数量: ${finalCount.total}`);

    return {
      success: true,
      message: `成功导入 ${successCount} 条教授数据（来自Excel转换的嵌入JSON数据）`,
      importedCount: successCount,
      totalInDatabase: finalCount.total,
      dataSource: 'Embedded JSON data from Excel conversion',
      sampleData: professorsData.slice(0, 3).map(p => ({
        name: p.教师姓名 || p.中文名,
        department: p.院系,
        research: p.研究方向
      }))
    };

  } catch (error) {
    console.error('导入过程发生错误:', error);
    return {
      success: false,
      message: '数据导入失败',
      error: error.toString()
    };
  }
};

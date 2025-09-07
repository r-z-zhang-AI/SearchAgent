const tcb = require('@cloudbase/node-sdk');

// 嵌入的教授数据（从professors_data.json提取）
const PROFESSORS_DATA = require('./professors_data.json');

// 云函数主体 - 支持分批导入
exports.main = async (event, context) => {
  try {
    console.log('开始分批导入教授数据...');

    // 初始化
    const app = tcb.init();
    const db = app.database();
    
    const professorsData = PROFESSORS_DATA;
    console.log(`总共有 ${professorsData.length} 条教授数据需要导入`);

    // 从event参数获取批次信息
    const batchStart = event.batchStart || 0;
    const batchSize = event.batchSize || 500; // 每次处理500条，减少超时风险
    const clearFirst = event.clearFirst || false;

    console.log(`本次处理: 第 ${batchStart + 1} - ${Math.min(batchStart + batchSize, professorsData.length)} 条数据`);

    // 1. 如果是第一批，清空现有数据
    if (clearFirst && batchStart === 0) {
      try {
        const existingCount = await db.collection('professors').count();
        console.log(`数据库中现有 ${existingCount.total} 条数据，开始清空...`);
        
        if (existingCount.total > 0) {
          // 分批删除
          const deleteBatchSize = 20;
          let totalDeleted = 0;
          
          while (totalDeleted < existingCount.total) {
            const deleteResult = await db.collection('professors').limit(deleteBatchSize).remove();
            totalDeleted += deleteResult.deleted;
            console.log(`已删除 ${totalDeleted}/${existingCount.total} 条旧数据`);
          }
          console.log('清空现有数据完成');
        }
      } catch (deleteError) {
        console.log('清空数据失败:', deleteError.toString());
      }
    }

    // 2. 获取当前批次的数据
    const currentBatch = professorsData.slice(batchStart, batchStart + batchSize);
    console.log(`当前批次数据量: ${currentBatch.length} 条`);

    // 3. 分小批次插入数据
    let successCount = 0;
    const insertBatchSize = 10; // 进一步减少每次插入的数量
    
    for (let i = 0; i < currentBatch.length; i += insertBatchSize) {
      const smallBatch = currentBatch.slice(i, i + insertBatchSize);
      
      try {
        const processedBatch = smallBatch.map((professor, index) => {
          // 过滤空值
          const cleanedData = {};
          Object.keys(professor).forEach(key => {
            if (professor[key] && professor[key].toString().trim() !== '') {
              cleanedData[key] = professor[key];
            }
          });

          // 添加时间戳和唯一ID
          cleanedData.importTime = new Date();
          cleanedData.id = `prof_${Date.now()}_${batchStart + i + index}_${Math.random().toString(36).substr(2, 9)}`;
          
          return cleanedData;
        });

        // 批量插入
        await db.collection('professors').add(processedBatch);
        successCount += processedBatch.length;
        console.log(`成功插入第 ${batchStart + i + 1}-${Math.min(batchStart + i + insertBatchSize, batchStart + currentBatch.length)} 条数据`);
      } catch (insertError) {
        console.error(`插入数据失败:`, insertError);
      }
    }

    // 4. 验证结果
    const finalCount = await db.collection('professors').count();
    console.log(`数据库中现有教授数量: ${finalCount.total}`);

    // 5. 检查是否还有更多数据需要处理
    const nextBatchStart = batchStart + batchSize;
    const hasMore = nextBatchStart < professorsData.length;
    const progress = Math.min(100, Math.round(((batchStart + successCount) / professorsData.length) * 100));

    return {
      success: true,
      message: `成功导入 ${successCount} 条教授数据（批次: ${batchStart + 1}-${batchStart + successCount}）`,
      batchInfo: {
        currentBatch: Math.floor(batchStart / batchSize) + 1,
        totalBatches: Math.ceil(professorsData.length / batchSize),
        batchStart: batchStart,
        batchSize: batchSize,
        processedInThisBatch: successCount,
        nextBatchStart: nextBatchStart,
        hasMore: hasMore,
        progress: `${progress}%`
      },
      totalData: professorsData.length,
      importedCount: successCount,
      totalInDatabase: finalCount.total,
      nextInvocation: hasMore ? {
        event: {
          batchStart: nextBatchStart,
          batchSize: batchSize,
          clearFirst: false
        },
        command: `tcb fn invoke importProfessorsData --envId cloud1-6g8dk2rk74e3d4e9 --params '{"batchStart":${nextBatchStart},"batchSize":${batchSize},"clearFirst":false}'`
      } : null
    };

  } catch (error) {
    console.error('导入过程发生错误:', error);
    return {
      success: false,
      message: '数据导入失败',
      error: error.toString(),
      batchInfo: {
        batchStart: event.batchStart || 0,
        batchSize: event.batchSize || 500
      }
    };
  }
};

const tcb = require('@cloudbase/node-sdk');
const fs = require('fs');
const path = require('path');

// 云函数主体 - 使用真实的JSON数据
exports.main = async (event, context) => {
  try {
    console.log('开始从JSON文件导入教授数据...');

    // 初始化
    const app = tcb.init();
    const db = app.database();
    
    // 读取本地JSON数据文件
    const jsonFilePath = path.join(__dirname, 'professors_data.json');
    console.log('读取JSON文件:', jsonFilePath);
    
    let professorsData;
    try {
      const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
      professorsData = JSON.parse(jsonContent);
      console.log(`从JSON文件中读取到 ${professorsData.length} 条教授数据`);
    } catch (readError) {
      console.error('读取JSON文件失败:', readError);
      return {
        success: false,
        message: '读取JSON数据文件失败',
        error: readError.toString()
      };
    }

    console.log(`准备导入 ${professorsData.length} 条真实教授数据`);

    // 可以选择是否清空现有数据
    const shouldClearExisting = event.clearExisting !== false; // 默认清空
    
    if (shouldClearExisting) {
      try {
        // 由于不能使用空的where条件，我们先查询再删除
        const existingData = await db.collection('professors').limit(1000).get();
        if (existingData.data && existingData.data.length > 0) {
          console.log(`发现 ${existingData.data.length} 条现有数据，开始清空...`);
          const deletePromises = existingData.data.map(item => 
            db.collection('professors').doc(item._id).remove()
          );
          await Promise.all(deletePromises);
          console.log('现有数据清空完成');
        } else {
          console.log('没有发现现有数据');
        }
      } catch (deleteError) {
        console.log('清空数据过程中的错误:', deleteError.toString());
      }
    }

    // 分批插入数据（避免单次插入过多）
    const batchSize = 20;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < professorsData.length; i += batchSize) {
      const batch = professorsData.slice(i, i + batchSize);
      console.log(`正在插入第 ${i + 1} 到 ${Math.min(i + batchSize, professorsData.length)} 条数据...`);

      // 并行处理当前批次
      const batchPromises = batch.map(async (professor) => {
        try {
          // 更新时间戳
          professor.importTime = new Date();
          
          await db.collection('professors').add(professor);
          successCount++;
          return { success: true, name: professor.教师姓名 || professor.中文名 };
        } catch (insertError) {
          errorCount++;
          console.error(`插入数据失败 (${professor.教师姓名 || professor.中文名}):`, insertError);
          return { success: false, name: professor.教师姓名 || professor.中文名, error: insertError };
        }
      });

      await Promise.all(batchPromises);
      
      // 显示进度
      console.log(`批次处理完成，当前成功: ${successCount}, 失败: ${errorCount}`);
    }

    // 验证插入结果
    const count = await db.collection('professors').count();
    console.log(`数据库中现有教授数量: ${count.total}`);

    // 获取一些示例数据用于展示
    const sampleData = await db.collection('professors').limit(5).get();
    const samples = sampleData.data.map(prof => ({
      name: prof.教师姓名 || prof.中文名,
      department: prof.院系,
      research: prof.研究方向,
      url: prof.url
    }));

    return {
      success: true,
      message: `成功导入 ${successCount} 条教授数据（真实数据）${errorCount > 0 ? `，${errorCount} 条失败` : ''}`,
      importedCount: successCount,
      errorCount: errorCount,
      totalInDatabase: count.total,
      dataSource: 'excel_converted_json',
      batchSize: batchSize,
      sampleData: samples
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

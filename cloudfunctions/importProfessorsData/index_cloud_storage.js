const tcb = require('@cloudbase/node-sdk');

// 云函数主体 - 从云存储读取JSON数据
exports.main = async (event, context) => {
  try {
    console.log('开始从云存储JSON文件导入教授数据...');

    // 初始化
    const app = tcb.init();
    const db = app.database();
    
    // JSON 文件在云存储中的路径
    const JSON_FILE_PATH = 'data/professors_data.json';
    
    // 1. 从云存储下载JSON文件
    let professorsData;
    try {
      const fileID = `cloud://cloud1-6g8dk2rk74e3d4e9.636c-cloud1-6g8dk2rk74e3d4e9-1330048678/${JSON_FILE_PATH}`;
      console.log('正在下载JSON文件:', fileID);
      
      // 获取临时下载链接
      const result = await app.getTempFileURL({
        fileList: [fileID]
      });
      
      if (result.fileList && result.fileList.length > 0) {
        const fileInfo = result.fileList[0];
        
        if (fileInfo.code) {
          throw new Error(`获取临时链接失败: ${fileInfo.code} - ${fileInfo.msg || '未知错误'}`);
        }
        
        if (fileInfo.tempFileURL) {
          console.log('获取临时URL成功');
          
          // 使用HTTP请求下载文件
          const https = require('https');
          const http = require('http');
          const url = require('url');
          
          const parsedUrl = url.parse(fileInfo.tempFileURL);
          const isHttps = parsedUrl.protocol === 'https:';
          const httpModule = isHttps ? https : http;
          
          const jsonContent = await new Promise((resolve, reject) => {
            httpModule.get(fileInfo.tempFileURL, (response) => {
              const chunks = [];
              response.on('data', (chunk) => chunks.push(chunk));
              response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
              response.on('error', reject);
            }).on('error', reject);
          });
          
          professorsData = JSON.parse(jsonContent);
          console.log(`从云存储JSON文件中读取到 ${professorsData.length} 条教授数据`);
        } else {
          throw new Error('无法获取文件的临时下载链接');
        }
      } else {
        throw new Error('getTempFileURL 返回空结果');
      }
    } catch (downloadError) {
      console.error('下载JSON文件失败:', downloadError);
      return {
        success: false,
        message: `下载JSON文件失败。请确保：
1. 文件已上传到云存储的 ${JSON_FILE_PATH} 路径
2. 云函数有读取云存储的权限
3. 文件格式为有效的JSON

当前尝试的文件路径: ${JSON_FILE_PATH}`,
        error: downloadError.toString(),
        uploadInstructions: `请使用以下命令上传JSON文件：
tcb storage upload cloudfunctions/importProfessorsData/professors_data.json data/professors_data.json --envId cloud1-6g8dk2rk74e3d4e9

或者通过云开发控制台手动上传到 data/ 目录下`
      };
    }

    console.log(`准备导入 ${professorsData.length} 条真实教授数据`);

    // 2. 清空现有数据（可选）
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

    // 3. 插入数据
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

    // 4. 验证插入结果
    const finalCount = await db.collection('professors').count();
    console.log(`数据库中现有教授数量: ${finalCount.total}`);

    return {
      success: true,
      message: `成功导入 ${successCount} 条教授数据（来自Excel转换的JSON文件）`,
      importedCount: successCount,
      totalInDatabase: finalCount.total,
      dataSource: 'JSON file from cloud storage',
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

const tcb = require('@cloudbase/node-sdk');
const xlsx = require('xlsx');

// 云函数主体
exports.main = async (event, context) => {
  try {
    console.log('开始从Excel文件导入教授数据...');

    // 在云函数内部初始化 - 使用更简单的方式
    const app = tcb.init();
    const db = app.database();
    
    // Excel 文件在云存储中的路径
    const FILE_PATH_IN_STORAGE = 'professors.xlsx';

    // 首先列出所有文件来调试
    try {
      console.log('正在列出云存储中的所有文件...');
      const fileList = await app.storage().listDirectoryFiles({
        prefix: '',
        maxKeys: 100
      });
      console.log('云存储文件列表:', JSON.stringify(fileList, null, 2));
    } catch (listError) {
      console.log('列出文件失败，尝试其他方法:', listError.toString());
    }

        // 1. 从云存储下载Excel文件
    let fileContent;
    try {
      // 使用正确的 fileID 格式
      const fileID = `cloud://cloud1-6g8dk2rk74e3d4e9.636c-cloud1-6g8dk2rk74e3d4e9-1330048678/${FILE_PATH_IN_STORAGE}`;
      
      console.log('正在下载文件:', fileID);
      
      // 先获取临时下载链接
      const result = await app.getTempFileURL({
        fileList: [fileID]
      });
      
      console.log('getTempFileURL 结果:', JSON.stringify(result, null, 2));
      
      if (result.fileList && result.fileList.length > 0) {
        const fileInfo = result.fileList[0];
        
        if (fileInfo.code) {
          throw new Error(`获取临时链接失败: ${fileInfo.code} - ${fileInfo.msg || '未知错误'}`);
        }
        
        if (fileInfo.tempFileURL) {
          console.log('获取临时URL成功:', fileInfo.tempFileURL);
          
          // 使用HTTP请求下载文件
          const https = require('https');
          const http = require('http');
          const url = require('url');
          
          const parsedUrl = url.parse(fileInfo.tempFileURL);
          const isHttps = parsedUrl.protocol === 'https:';
          const httpModule = isHttps ? https : http;
          
          fileContent = await new Promise((resolve, reject) => {
            httpModule.get(fileInfo.tempFileURL, (response) => {
              const chunks = [];
              response.on('data', (chunk) => chunks.push(chunk));
              response.on('end', () => resolve(Buffer.concat(chunks)));
              response.on('error', reject);
            }).on('error', reject);
          });
          
          console.log('Excel文件下载成功, 大小:', fileContent.length, 'bytes');
        } else {
          throw new Error('无法获取文件的临时下载链接');
        }
      } else {
        throw new Error('getTempFileURL 返回空结果');
      }
    } catch (downloadError) {
      console.error('下载Excel文件失败:', downloadError);
      
      // 提供详细的错误信息和解决方案
      return {
        success: false,
        message: `下载Excel文件失败。请确保：
1. 文件已上传到云存储的 ${FILE_PATH_IN_STORAGE} 路径
2. 云函数有读取云存储的权限
3. 文件格式为Excel (.xlsx)

当前尝试的文件路径: ${FILE_PATH_IN_STORAGE}`,
        error: downloadError.toString(),
        uploadInstructions: '请使用云开发控制台将 professors.xlsx 文件上传到 data/ 目录下',
        troubleshooting: `
请检查：
1. 使用命令查看文件是否存在: tcb storage list --envId cloud1-6g8dk2rk74e3d4e9
2. 重新上传文件: tcb storage upload professors.xlsx data/professors.xlsx --envId cloud1-6g8dk2rk74e3d4e9
3. 确认文件路径和权限设置正确`
      };
    }

    // 2. 解析Excel数据
    let jsonData;
    try {
      const workbook = xlsx.read(fileContent, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      jsonData = xlsx.utils.sheet_to_json(worksheet);
      console.log(`从Excel文件中成功解析到 ${jsonData.length} 条原始数据`);
    } catch (parseError) {
      console.error('解析Excel文件失败:', parseError);
      return {
        success: false,
        message: '解析Excel文件失败',
        error: parseError.toString()
      };
    }

    const collection = db.collection('professors');
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // 3. 数据清理和导入
    for (const row of jsonData) {
      try {
        const professorData = {};

        // 定义所有可能的列名（包含完整的列名列表）
        const allColumns = [
          'url', '教师姓名', '中文名', '毕业院校', '院系职称', '院系', '学历', '职称', 
          '邮箱', '地址', '研究方向', '单位', '个人简介',
          'info1', 'info2', 'info3', 'info4', 'info5', 'info6', 'info7', 'info8', 
          'info9', 'info10', 'info11', 'info12', 'info13', 'info14', 'info15', 'info16', 'info17'
        ];

        // 处理所有字段，只保留非空值
        allColumns.forEach(colName => {
          const value = row[colName];
          
          // 严格的空值检查：排除 null, undefined, 空字符串, 只包含空白字符的字符串
          if (value !== null && 
              value !== undefined && 
              value !== '' && 
              String(value).trim() !== '' &&
              String(value).trim() !== 'null' &&
              String(value).trim() !== 'undefined') {
            
            let cleanValue = String(value).trim();
            
            // 特殊字段处理
            if (colName === '研究方向' && cleanValue) {
              // 研究方向可能包含多个方向，标准化分隔符
              cleanValue = cleanValue.replace(/[;；]/g, ',').replace(/\s*,\s*/g, ', ');
            }
            
            if (colName === '邮箱' && cleanValue) {
              // 简单的邮箱格式检查
              const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!emailRegex.test(cleanValue)) {
                console.warn(`教师 ${row['教师姓名'] || row['中文名'] || '未知'} 的邮箱格式可能有误: ${cleanValue}`);
              }
            }
            
            professorData[colName] = cleanValue;
          }
        });

        // 检查是否有有效数据（至少需要教师姓名或中文名）
        if (!professorData['教师姓名'] && !professorData['中文名']) {
          console.warn('跳过一条数据：缺少教师姓名和中文名');
          skippedCount++;
          continue;
        }

        // 检查是否至少有一些有用的信息
        if (Object.keys(professorData).length < 2) {
          console.warn(`跳过一条数据：信息过少 - ${professorData['教师姓名'] || professorData['中文名']}`);
          skippedCount++;
          continue;
        }

        // 添加创建时间和更新时间
        professorData.createdAt = new Date().toISOString();
        professorData.updatedAt = new Date().toISOString();

        // 插入数据库
        await collection.add(professorData);
        successCount++;
        console.log(`成功导入: ${professorData['教师姓名']}`);

      } catch (e) {
        console.error(`导入失败: ${row['教师姓名'] || '未知姓名'}`, e);
        failCount++;
      }
    }

    const resultMessage = `Excel数据导入完成！总计: ${jsonData.length} 条, 成功: ${successCount} 条, 失败: ${failCount} 条, 跳过: ${skippedCount} 条`;
    console.log(resultMessage);

    return {
      success: true,
      message: resultMessage,
      data: {
        total: jsonData.length,
        successCount,
        failCount,
        skippedCount
      }
    };

  } catch (error) {
    console.error('导入过程中发生错误:', error);
    return {
      success: false,
      message: '导入失败: ' + error.message,
      error: error.toString()
    };
  }
};
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

/**
 * 本地Excel转JSON工具
 * 将Excel文件转换为JSON格式，用于上传到云函数
 */
async function convertExcelToJson() {
  try {
    console.log('开始转换Excel文件到JSON格式...');

    // Excel文件路径
    const excelFilePath = path.join(__dirname, '../../files/professors.xlsx');
    const outputJsonPath = path.join(__dirname, 'professors_data.json');

    // 检查Excel文件是否存在
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel文件不存在: ${excelFilePath}`);
    }

    console.log('读取Excel文件:', excelFilePath);

    // 读取Excel文件
    const workbook = xlsx.readFile(excelFilePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = xlsx.utils.sheet_to_json(worksheet);

    console.log(`从Excel文件中读取到 ${jsonData.length} 条原始数据`);

    // 定义所有可能的列名
    const allColumns = [
      'url', '教师姓名', '中文名', '毕业院校', '院系职称', '院系', '学历', '职称', 
      '邮箱', '地址', '研究方向', '单位', '个人简介',
      'info1', 'info2', 'info3', 'info4', 'info5', 'info6', 'info7', 'info8',
      'info9', 'info10', 'info11', 'info12', 'info13', 'info14', 'info15', 
      'info16', 'info17'
    ];

    // 清理和处理数据
    const cleanedData = [];
    let validCount = 0;

    for (const row of jsonData) {
      // 检查是否有有效的教师姓名或中文名
      if (!row['教师姓名'] && !row['中文名']) {
        console.log('跳过无效记录: 缺少教师姓名和中文名');
        continue;
      }

      // 创建清理后的记录
      const cleanedRecord = {};
      
      // 处理所有列，过滤空值
      allColumns.forEach(column => {
        const value = row[column];
        if (value !== undefined && value !== null && value !== '') {
          // 转换为字符串并去除前后空格
          const stringValue = String(value).trim();
          if (stringValue !== '' && stringValue !== 'null' && stringValue !== 'undefined') {
            cleanedRecord[column] = stringValue;
          }
        }
      });

      // 添加元数据
      cleanedRecord.importTime = new Date().toISOString();
      cleanedRecord.id = `prof_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      cleanedRecord.source = 'excel_import';

      cleanedData.push(cleanedRecord);
      validCount++;

      // 显示处理进度
      if (validCount % 100 === 0) {
        console.log(`已处理 ${validCount} 条有效记录...`);
      }
    }

    console.log(`数据清理完成，有效记录数: ${validCount}`);

    // 保存为JSON文件
    fs.writeFileSync(outputJsonPath, JSON.stringify(cleanedData, null, 2), 'utf8');
    console.log(`JSON文件已保存到: ${outputJsonPath}`);

    // 显示数据统计
    console.log('\n=== 数据统计 ===');
    console.log(`总记录数: ${jsonData.length}`);
    console.log(`有效记录数: ${validCount}`);
    console.log(`跳过记录数: ${jsonData.length - validCount}`);

    // 显示前3条示例数据
    console.log('\n=== 示例数据 ===');
    cleanedData.slice(0, 3).forEach((record, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log(`  姓名: ${record['教师姓名'] || record['中文名']}`);
      console.log(`  院系: ${record['院系'] || '未知'}`);
      console.log(`  研究方向: ${record['研究方向'] || '未知'}`);
      console.log(`  字段数: ${Object.keys(record).length}`);
    });

    // 生成上传到云函数的代码片段
    const cloudFunctionCode = `
// 将以下代码替换到云函数的 index.js 中的 mockData 部分
const professorsData = ${JSON.stringify(cleanedData.slice(0, 50), null, 2)};

// 如果数据量很大，建议分批处理
console.log('从本地JSON导入 \\${professorsData.length} 条教授数据');
`;

    const codeSnippetPath = path.join(__dirname, 'upload_code_snippet.js');
    fs.writeFileSync(codeSnippetPath, cloudFunctionCode, 'utf8');
    console.log(`\n云函数代码片段已保存到: ${codeSnippetPath}`);

    return {
      success: true,
      totalRecords: jsonData.length,
      validRecords: validCount,
      jsonFile: outputJsonPath,
      codeSnippet: codeSnippetPath,
      sampleData: cleanedData.slice(0, 3)
    };

  } catch (error) {
    console.error('转换失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  convertExcelToJson().then(result => {
    if (result.success) {
      console.log('\n✅ Excel转JSON转换成功!');
      console.log(`📊 处理了 ${result.totalRecords} 条记录，有效记录 ${result.validRecords} 条`);
      console.log(`📄 JSON文件: ${result.jsonFile}`);
      console.log(`💻 代码片段: ${result.codeSnippet}`);
    } else {
      console.log('\n❌ 转换失败:', result.error);
    }
  });
}

module.exports = { convertExcelToJson };

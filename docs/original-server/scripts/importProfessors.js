const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// 数据库路径
const dbPath = path.join(__dirname, '../data/professors.db');
const excelPath = path.join(__dirname, '../data/professors.xlsx');

console.log('🚀 开始导入教授数据...');

// 检查文件是否存在
if (!fs.existsSync(excelPath)) {
  console.error('❌ Excel文件不存在:', excelPath);
  process.exit(1);
}

// 数据库连接
const db = new sqlite3.Database(dbPath);

// 清理和标准化数据
function cleanData(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    return value.trim().replace(/\s+/g, ' ');
  }
  return String(value);
}

// 解析数组字段
function parseArrayField(value) {
  if (!value) return '';
  const str = cleanData(value);
  const separators = [',', '，', ';', '；', '|', '\n'];
  let result = str;
  
  separators.forEach(sep => {
    if (result.includes(sep)) {
      result = result.split(sep).map(item => item.trim()).filter(item => item).join(',');
    }
  });
  
  return result;
}

// 主函数
async function main() {
  try {
    // 1. 重建数据库表
    console.log('🔧 重建数据库表...');
    await new Promise((resolve, reject) => {
      db.run(`DROP TABLE IF EXISTS professors`, (err) => {
        if (err) reject(err);
        else {
          db.run(`CREATE TABLE professors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            title TEXT,
            department TEXT,
            research_areas TEXT,
            email TEXT,
            office TEXT,
            phone TEXT,
            education TEXT,
            bio TEXT,
            website TEXT,
            keywords TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (err) => {
            if (err) reject(err);
            else resolve();
          });
        }
      });
    });

    // 2. 读取Excel文件
    console.log('📖 读取Excel文件...');
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false
    });

    console.log(`📊 总行数: ${jsonData.length}`);
    
    if (jsonData.length < 2) {
      console.error('❌ 数据不足');
      return;
    }

    // 3. 映射列名
    const headers = jsonData[0].map(h => cleanData(h).toLowerCase());
    console.log('📋 表头:', headers);

    const columnMapping = {
      '中文名': 'name',
      '职称': 'title',
      '院系': 'department',
      '研究方向': 'research_areas',
      '邮箱': 'email',
      '地址': 'office',
      '学历': 'education',
      '个人简介': 'bio'
    };

    const columnIndexes = {};
    headers.forEach((header, index) => {
      const dbField = columnMapping[header];
      if (dbField) {
        columnIndexes[dbField] = index;
        console.log(`📌 映射: ${header} -> ${dbField} (列${index})`);
      }
    });

    if (!columnIndexes.name) {
      console.error('❌ 未找到姓名列');
      return;
    }

    // 4. 插入数据
    console.log('💾 开始插入数据...');
    const insertSQL = `INSERT INTO professors (
      name, title, department, research_areas, email, office, phone, 
      education, bio, website, keywords
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    let successCount = 0;
    let errorCount = 0;

    // 使用串行化处理
    db.serialize(() => {
      const stmt = db.prepare(insertSQL);
      
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        
        if (!row || row.length === 0) continue;
        
        const professorData = {
          name: cleanData(row[columnIndexes.name] || ''),
          title: cleanData(row[columnIndexes.title] || ''),
          department: cleanData(row[columnIndexes.department] || ''),
          research_areas: parseArrayField(row[columnIndexes.research_areas] || ''),
          email: cleanData(row[columnIndexes.email] || ''),
          office: cleanData(row[columnIndexes.office] || ''),
          phone: '',
          education: cleanData(row[columnIndexes.education] || ''),
          bio: cleanData(row[columnIndexes.bio] || ''),
          website: '',
          keywords: ''
        };
        
        if (!professorData.name) {
          console.warn(`⚠️ 第${i+1}行：姓名为空，跳过`);
          continue;
        }
        
        try {
          stmt.run([
            professorData.name,
            professorData.title,
            professorData.department,
            professorData.research_areas,
            professorData.email,
            professorData.office,
            professorData.phone,
            professorData.education,
            professorData.bio,
            professorData.website,
            professorData.keywords
          ]);
          
          successCount++;
          
          if (successCount % 1000 === 0) {
            console.log(`📊 已处理: ${successCount} 条记录`);
          }
          
        } catch (error) {
          errorCount++;
          if (errorCount < 5) {
            console.error(`❌ 第${i+1}行插入失败:`, error.message);
          }
        }
      }
      
      stmt.finalize(() => {
        console.log('🎉 数据导入完成！');
        console.log(`✅ 成功导入: ${successCount} 条记录`);
        console.log(`❌ 失败记录: ${errorCount} 条`);
        
        // 验证数据
        db.get("SELECT COUNT(*) as count FROM professors", (err, row) => {
          if (err) {
            console.error('❌ 验证失败:', err);
          } else {
            console.log(`🔍 数据库中共有 ${row.count} 条教授记录`);
          }
          
          db.close((err) => {
            if (err) {
              console.error('❌ 关闭数据库失败:', err);
            } else {
              console.log('✅ 数据库连接已关闭');
            }
          });
        });
      });
    });

  } catch (error) {
    console.error('❌ 导入过程出错:', error);
    db.close();
  }
}

// 运行主函数
main();

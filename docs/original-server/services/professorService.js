const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 数据库连接
const dbPath = path.join(__dirname, '../data/professors.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('数据库连接成功');
  }
});

// 初始化数据库
function initDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 创建教授表
      db.run(`CREATE TABLE IF NOT EXISTS professors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        title TEXT,
        department TEXT,
        research_areas TEXT,
        email TEXT,
        office TEXT,
        phone TEXT,
        introduction TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // 创建成果表
      db.run(`CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professor_id INTEGER,
        type TEXT,
        title TEXT,
        description TEXT,
        year INTEGER,
        journal TEXT,
        impact_factor REAL,
        citations INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES professors (id)
      )`);

      // 创建项目表
      db.run(`CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        professor_id INTEGER,
        name TEXT,
        description TEXT,
        role TEXT,
        funding_amount REAL,
        start_date TEXT,
        end_date TEXT,
        status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (professor_id) REFERENCES professors (id)
      )`);

      resolve();
    });
  });
}

// 获取教授列表
function getProfessors(options = {}) {
  return new Promise((resolve, reject) => {
    const { page = 1, limit = 10, department, research_area, search } = options;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    let params = [];
    
    if (department) {
      whereClause += ' WHERE department LIKE ?';
      params.push(`%${department}%`);
    }
    
    if (research_area) {
      whereClause += whereClause ? ' AND' : ' WHERE';
      whereClause += ' research_areas LIKE ?';
      params.push(`%${research_area}%`);
    }
    
    if (search) {
      whereClause += whereClause ? ' AND' : ' WHERE';
      whereClause += ' (name LIKE ? OR department LIKE ? OR research_areas LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM professors${whereClause}`;
    const dataQuery = `SELECT * FROM professors${whereClause} ORDER BY name LIMIT ? OFFSET ?`;
    
    db.get(countQuery, params, (err, countResult) => {
      if (err) {
        reject(err);
        return;
      }
      
      db.all(dataQuery, [...params, limit, offset], async (err, professors) => {
        if (err) {
          reject(err);
          return;
        }
        
        // 为每个教授获取成果和项目信息
        for (const professor of professors) {
          professor.achievements = await getAchievements(professor.id);
          professor.projects = await getProjects(professor.id);
          professor.research_areas = professor.research_areas ? 
            professor.research_areas.split(',').map(area => area.trim()) : [];
        }
        
        resolve({
          data: professors,
          pagination: {
            page,
            limit,
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        });
      });
    });
  });
}

// 获取单个教授
function getProfessorById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM professors WHERE id = ?', [id], async (err, professor) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (!professor) {
        resolve(null);
        return;
      }
      
      // 获取成果和项目信息
      professor.achievements = await getAchievements(id);
      professor.projects = await getProjects(id);
      professor.research_areas = professor.research_areas ? 
        professor.research_areas.split(',').map(area => area.trim()) : [];
      
      resolve(professor);
    });
  });
}

// 获取教授成果
function getAchievements(professorId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM achievements WHERE professor_id = ? ORDER BY year DESC', [professorId], (err, achievements) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(achievements);
    });
  });
}

// 获取教授项目
function getProjects(professorId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM projects WHERE professor_id = ? ORDER BY start_date DESC', [professorId], (err, projects) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(projects);
    });
  });
}

// 插入测试数据
function insertTestData() {
  return new Promise((resolve, reject) => {
    const testProfessors = [
      {
        name: '张三',
        title: '教授',
        department: '计算机科学与技术学院',
        research_areas: '人工智能,机器学习,计算机视觉',
        email: 'zhangsan@zju.edu.cn',
        office: '玉泉校区曹光彪楼',
        phone: '0571-8795xxxx',
        introduction: '主要从事人工智能和机器学习研究，在计算机视觉领域有丰富经验。'
      },
      {
        name: '李四',
        title: '副教授',
        department: '信息与电子工程学院',
        research_areas: '信号处理,通信工程,物联网',
        email: 'lisi@zju.edu.cn',
        office: '紫金港校区信电楼',
        phone: '0571-8795xxxx',
        introduction: '专注于信号处理和通信工程研究，在物联网技术方面有深入研究。'
      },
      {
        name: '王五',
        title: '教授',
        department: '材料科学与工程学院',
        research_areas: '新材料,纳米技术,能源材料',
        email: 'wangwu@zju.edu.cn',
        office: '紫金港校区材料楼',
        phone: '0571-8795xxxx',
        introduction: '主要从事新材料和纳米技术研究，在能源材料领域有重要贡献。'
      }
    ];
    
    const stmt = db.prepare('INSERT INTO professors (name, title, department, research_areas, email, office, phone, introduction) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    
    testProfessors.forEach(professor => {
      stmt.run([
        professor.name,
        professor.title,
        professor.department,
        professor.research_areas,
        professor.email,
        professor.office,
        professor.phone,
        professor.introduction
      ]);
    });
    
    stmt.finalize((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// 初始化数据库并插入测试数据
async function initializeDatabase() {
  try {
    await initDatabase();
    console.log('数据库表创建完成');
    
    // 检查是否已有数据
    const result = await getProfessors({ page: 1, limit: 1 });
    if (result.data.length === 0) {
      await insertTestData();
      console.log('测试数据插入成功');
    } else {
      console.log('数据库中已有数据，跳过测试数据插入');
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

module.exports = {
  getProfessors,
  getProfessorById,
  getAchievements,
  getProjects,
  initializeDatabase
};
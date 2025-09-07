// 教授数据服务 - 基于原始服务器逻辑适配云数据库
const tcb = require('@cloudbase/node-sdk');

// 获取教授列表 - 完全按照原始逻辑适配云数据库
async function getProfessors(options = {}, db) {
  try {
    const { page = 1, limit = 10, department, research_area, search } = options;
    
    console.log('getProfessors 调用参数:', { page, limit, department, research_area, search });
    
    if (!db) {
      console.error('数据库实例未提供');
      return { data: [], total: 0, pagination: { page, limit, total: 0, pages: 0 } };
    }

    // 构建查询条件 - 与原始SQLite逻辑一致
    let query = db.collection('professors');
    const conditions = [];
    
    // 添加筛选条件 - 使用原始逻辑
    if (department) {
      conditions.push({
        院系: db.RegExp({
          regexp: department,
          options: 'i'
        })
      });
    }
    
    if (research_area) {
      conditions.push({
        研究方向: db.RegExp({
          regexp: research_area,
          options: 'i'
        })
      });
    }
    
    if (search) {
      // 对应原始SQL中的 (name LIKE ? OR department LIKE ? OR research_areas LIKE ?)
      conditions.push(db.command.or([
        {
          教师姓名: db.RegExp({
            regexp: search,
            options: 'i'
          })
        },
        {
          院系: db.RegExp({
            regexp: search,
            options: 'i'
          })
        },
        {
          研究方向: db.RegExp({
            regexp: search,
            options: 'i'
          })
        }
      ]));
    }

    // 应用条件
    if (conditions.length > 0) {
      query = query.where(db.command.and(conditions));
    }

    // 获取总数
    const countResult = await query.count();
    const total = countResult.total;
    
    console.log('查询到的总数:', total);

    // 获取分页数据 - 不使用排序以避免字段名问题
    const skip = (page - 1) * limit;
    const result = await query
      .skip(skip)
      .limit(limit)
      .get();
    
    console.log('分页查询结果数量:', result.data.length);
    
    // 为每个教授获取成果和项目信息 - 与原始逻辑一致
    const professors = [];
    for (const professor of result.data) {
      const standardizedProfessor = await getProfessorWithDetails(professor, db);
      professors.push(standardizedProfessor);
    }
    
    if (professors.length > 0) {
      console.log('处理后的第一个教授数据:', JSON.stringify(professors[0], null, 2));
    }

    return {
      data: professors,
      pagination: {
        page,
        limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('获取教授列表失败:', error);
    return { 
      data: [], 
      pagination: { page: 1, limit: 10, total: 0, pages: 0 } 
    };
  }
}

// 获取单个教授详细信息 - 对应原始的getProfessorById
async function getProfessorWithDetails(professor, db) {
  try {
    // 标准化教授基本信息
    const standardizedProfessor = standardizeProfessorData(professor);
    
    // 获取成果和项目信息 - 模拟原始逻辑
    standardizedProfessor.achievements = await getAchievements(standardizedProfessor.id, db);
    standardizedProfessor.projects = await getProjects(standardizedProfessor.id, db);
    
    return standardizedProfessor;
  } catch (error) {
    console.error('获取教授详细信息失败:', error);
    return standardizeProfessorData(professor);
  }
}

// 获取教授成果 - 对应原始getAchievements
async function getAchievements(professorId, db) {
  try {
    // 暂时返回空数组，后续可以实现成果查询
    return [];
  } catch (error) {
    console.error('获取成果失败:', error);
    return [];
  }
}

// 获取教授项目 - 对应原始getProjects
async function getProjects(professorId, db) {
  try {
    // 暂时返回空数组，后续可以实现项目查询
    return [];
  } catch (error) {
    console.error('获取项目失败:', error);
    return [];
  }
}

// 标准化教授数据 - 将中文字段转换为原始服务器的英文字段名
function standardizeProfessorData(professor) {
  // 处理研究方向字段 - 与原始逻辑一致，转换为数组
  let research_areas = [];
  if (professor.研究方向) {
    if (typeof professor.研究方向 === 'string') {
      // 对应原始SQL中的 split(',').map(area => area.trim())
      research_areas = professor.研究方向.split(/[,，;；]/).map(area => area.trim()).filter(area => area);
    } else if (Array.isArray(professor.研究方向)) {
      research_areas = professor.研究方向;
    }
  }
  
  // 数据清洗和修正 - 处理错位的字段值
  let cleanTitle = professor.职称 || professor.title || '';
  let cleanEmail = professor.邮箱 || professor.email || '';
  let cleanOffice = professor.办公地址 || professor.办公室 || professor.office || '';
  let cleanEducation = professor.学历 || professor.education || '';
  
  // 检测和修正邮箱字段错位问题
  if (cleanTitle && cleanTitle.includes('@')) {
    // 职称字段包含@符号，可能是邮箱
    cleanEmail = cleanTitle;
    // 从学历字段中提取真正的职称
    if (cleanEducation && (cleanEducation.includes('教授') || cleanEducation.includes('副教授') || cleanEducation.includes('讲师'))) {
      const titleMatch = cleanEducation.match(/(副教授|教授|讲师|研究员)/);
      cleanTitle = titleMatch ? titleMatch[1] : '教授';
    } else {
      cleanTitle = '教授'; // 设置默认职称
    }
  }
  
  // 检测和修正办公地址字段错位问题
  if (cleanEmail && !cleanEmail.includes('@') && (cleanEmail.includes('校区') || cleanEmail.includes('楼'))) {
    // 邮箱字段包含校区/楼，可能是办公地址
    cleanOffice = cleanEmail;
    cleanEmail = ''; // 清空错误的邮箱
  }
  
  // 检测办公地址字段中的研究方向内容
  if (cleanOffice && cleanOffice.length < 20 && !cleanOffice.includes('校区') && !cleanOffice.includes('楼') && !cleanOffice.includes('室')) {
    // 办公地址太短且不包含位置信息，可能是研究方向
    if (research_areas.length === 0) {
      research_areas = [cleanOffice];
    }
    cleanOffice = ''; // 清空错误的办公地址
  }
  
  // 返回与原始服务器完全一致的数据结构
  return {
    id: professor._id,
    name: professor.教师姓名 || professor.name || '',
    title: cleanTitle,
    department: professor.院系 || professor.department || '',
    research_areas: research_areas, // 数组格式，与原始一致
    email: cleanEmail,
    office: cleanOffice,
    phone: professor.电话 || professor.phone || '',
    education: cleanEducation,
    bio: professor.个人简介 || professor.简介 || professor.introduction || professor.bio || '',
    introduction: professor.简介 || professor.introduction || '',
    homepage: professor.个人主页 || professor.homepage || '',
    achievements: [], // 将在getProfessorWithDetails中填充
    projects: [], // 将在getProfessorWithDetails中填充
    created_at: professor.created_at || new Date(),
    updated_at: professor.updated_at || new Date()
  };
}

// 标准化研究方向字段
function normalizeResearchAreas(researchAreasData) {
  if (!researchAreasData) return [];
  
  if (Array.isArray(researchAreasData)) {
    return researchAreasData;
  }
  
  if (typeof researchAreasData === 'string') {
    // 按常见分隔符分割
    return researchAreasData.split(/[,，;；\n]/)
      .map(area => area.trim())
      .filter(area => area.length > 0);
  }
  
  return [];
}

// 获取单个教授
function getProfessorById(id, db) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await db.collection('professors').doc(id).get();

      if (!result.data || result.data.length === 0) {
        resolve(null);
        return;
      }

      const professor = result.data[0];

      // 标准化字段名
      const standardized = {
        id: professor._id,
        name: professor['教师姓名'] || professor['中文名'] || professor.name,
        title: professor['职称'] || professor.title,
        department: professor['院系'] || professor.department,
        email: professor['邮箱'] || professor.email,
        office: professor['地址'] || professor.office,
        introduction: professor['个人简介'] || professor.bio || professor.introduction,
        research_areas: normalizeResearchAreas(professor['研究方向'] || professor.research_areas),
        // 保留原始数据
        ...professor
      };

      // 获取成果和项目信息
      standardized.achievements = await getAchievements(id, db);
      standardized.projects = await getProjects(id, db);

      resolve(standardized);
    } catch (error) {
      console.error('获取教授详情失败:', error);
      reject(error);
    }
  });
}

// 获取教授成果（暂时返回空数组，因为云数据库中可能没有单独的成果表）
function getAchievements(professorId, db) {
  return new Promise((resolve, reject) => {
    // 暂时返回空数组，后续可以根据需要实现
    resolve([]);
  });
}

// 获取教授项目（暂时返回空数组，因为云数据库中可能没有单独的项目表）
function getProjects(professorId, db) {
  return new Promise((resolve, reject) => {
    // 暂时返回空数组，后续可以根据需要实现
    resolve([]);
  });
}

// 查询成果
function queryAchievements(intent, db) {
  return new Promise((resolve, reject) => {
    // 暂时返回空数组
    resolve([]);
  });
}

module.exports = {
  getProfessors,
  getProfessorById,
  getAchievements,
  getProjects,
  queryAchievements
};

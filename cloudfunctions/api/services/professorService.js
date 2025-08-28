// 获取教授列表
function getProfessors(options = {}, db) {
  return new Promise(async (resolve, reject) => {
    try {
      const { page = 1, limit = 10, department, research_area, search } = options;

      let query = {};

      // 构建查询条件
      const _ = db.command;

      if (department) {
        query['院系'] = _.like(department);
      }

      if (research_area) {
        query['研究方向'] = _.like(research_area);
      }

      if (search) {
        query = _.or([
          { '教师姓名': _.like(search) },
          { '院系': _.like(search) },
          { '研究方向': _.like(search) }
        ]);
      }

      // 获取总数
      const countResult = await db.collection('professors').where(query).count();
      const total = countResult.total;

      // 获取数据
      const result = await db.collection('professors')
        .where(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .orderBy('_id', 'asc')
        .get();

      // 为每个教授获取成果和项目信息，并标准化字段名
      const professors = result.data;
      for (const professor of professors) {
        // 标准化字段名，方便前端使用
        professor.name = professor['教师姓名'] || professor.name;
        professor.department = professor['院系'] || professor.department;
        professor.title = professor['职称'] || professor.title;
        professor.email = professor['邮箱'] || professor.email;
        professor.research_areas = professor['研究方向'] || professor.research_areas;
        professor.bio = professor['个人简介'] || professor.bio;
        professor.education = professor['学历'] || professor.education;
        professor.graduate_school = professor['毕业院校'] || professor.graduate_school;

        // 处理研究方向数组
        if (professor.research_areas && typeof professor.research_areas === 'string') {
          professor.research_areas = professor.research_areas.split(/[,，;；]/).map(area => area.trim()).filter(area => area);
        } else if (!Array.isArray(professor.research_areas)) {
          professor.research_areas = [];
        }

        professor.achievements = await getAchievements(professor._id, db);
        professor.projects = await getProjects(professor._id, db);
      }

      resolve({
        data: professors,
        pagination: {
          page,
          limit,
          total: total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 获取单个教授
function getProfessorById(id, db) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await db.collection('professors').doc(id).get();

      if (!result.data.length) {
        resolve(null);
        return;
      }

      const professor = result.data[0];

      // 标准化字段名
      professor.name = professor['教师姓名'] || professor.name;
      professor.department = professor['院系'] || professor.department;
      professor.title = professor['职称'] || professor.title;
      professor.email = professor['邮箱'] || professor.email;
      professor.research_areas = professor['研究方向'] || professor.research_areas;
      professor.bio = professor['个人简介'] || professor.bio;
      professor.education = professor['学历'] || professor.education;
      professor.graduate_school = professor['毕业院校'] || professor.graduate_school;

      // 处理研究方向数组
      if (professor.research_areas && typeof professor.research_areas === 'string') {
        professor.research_areas = professor.research_areas.split(/[,，;；]/).map(area => area.trim()).filter(area => area);
      } else if (!Array.isArray(professor.research_areas)) {
        professor.research_areas = [];
      }

      // 获取成果和项目信息
      professor.achievements = await getAchievements(id, db);
      professor.projects = await getProjects(id, db);

      resolve(professor);
    } catch (error) {
      reject(error);
    }
  });
}

// 获取教授成果
function getAchievements(professorId, db) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await db.collection('achievements')
        .where({ professor_id: professorId })
        .orderBy('year', 'desc')
        .get();

      resolve(result.data);
    } catch (error) {
      reject(error);
    }
  });
}

// 获取教授项目
function getProjects(professorId, db) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await db.collection('projects')
        .where({ professor_id: professorId })
        .orderBy('start_date', 'desc')
        .get();

      resolve(result.data);
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  getProfessors,
  getProfessorById,
  getAchievements,
  getProjects
};
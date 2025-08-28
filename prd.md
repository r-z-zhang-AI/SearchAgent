# 智能科研匹配Agent产品需求文档 (PRD)

## 1. 产品概述

### 1.1 产品名称
浙江大学智能科研匹配Agent (ZJU Research Matching Agent)

### 1.2 产品定位
面向企业、园区等机构的智能科研合作匹配平台，通过自然语言交互方式，帮助企业快速找到最合适的浙江大学教授进行科研合作。

### 1.3 核心价值
- **降低合作门槛**：企业通过自然语言描述需求，无需深入了解学术领域
- **提高匹配效率**：AI自动解析意图，精准匹配相关教授
- **增强合作成功率**：基于详细的研究方向、成果、项目经历进行匹配
- **促进产学研合作**：搭建企业与高校科研资源的桥梁

## 2. 目标用户

### 2.1 主要用户群体
- **企业用户**：寻求技术合作、研发支持的企业
- **园区管理者**：需要为园区企业匹配科研资源的园区管理者
- **政府机构**：推动产学研合作的政府部门
- **投资机构**：寻找技术投资机会的投资机构

### 2.2 用户需求分析
- 快速了解教授的研究方向和专长
- 获得匹配理由和合作建议
- 查看教授的研究成果和项目经历
- 获取联系方式进行进一步沟通

## 3. 功能需求

### 3.1 核心功能

#### 3.1.1 智能对话交互
- **自然语言输入**：支持中文自然语言描述合作需求
- **意图解析**：AI自动解析用户的技术需求、合作意向
- **多轮对话**：支持追问、澄清、细化需求
- **上下文理解**：保持对话连贯性，理解上下文
- **通用问答能力**：回答与科研合作无关的一般性问题
- **需求澄清机制**：当用户需求模糊时，主动引导用户明确需求
- **追问推荐**：每轮对话后提供相关的追问建议，引导用户深入交流
- **成果查询**：支持用户查询特定领域或特定教授的科研成果详情

#### 3.1.2 智能匹配推荐
- **研究方向匹配**：基于教授研究领域进行初步筛选
- **成果相关性分析**：分析教授研究成果与需求的匹配度
- **项目经历评估**：考虑教授过往项目经验
- **综合评分排序**：多维度评估后给出推荐排序

#### 3.1.3 匹配结果展示
- **教授基本信息**：姓名、职称、所属院系
- **研究方向**：主要研究领域和专长
- **代表性成果**：重要论文、专利、获奖情况
- **项目经历**：主持或参与的重要项目
- **匹配理由**：AI生成的匹配原因说明
- **联系方式**：邮箱、办公室等联系信息

#### 3.1.4 结果筛选与排序
- **按匹配度排序**：优先展示最相关的教授
- **按研究方向筛选**：支持按学科领域筛选
- **按职称筛选**：支持按教授、副教授等职称筛选
- **按成果类型筛选**：支持按论文、专利、项目等筛选

### 3.2 辅助功能

#### 3.2.1 用户管理
- **用户注册登录**：支持企业用户注册和登录
- **需求历史记录**：保存用户的查询历史
- **收藏功能**：支持收藏感兴趣的教授

#### 3.2.2 数据管理
- **教授信息管理**：后台管理教授基本信息
- **成果数据管理**：管理论文、专利、项目等数据
- **数据更新机制**：定期更新教授最新成果

#### 3.2.3 统计分析
- **查询统计**：统计热门查询和匹配情况
- **合作效果分析**：分析匹配后的合作成功率
- **用户行为分析**：分析用户使用习惯和偏好

## 4. 技术架构

### 4.1 整体架构
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端界面      │    │   后端服务      │    │   数据库        │
│                │    │                │    │                │
│ - 聊天界面     │◄──►│ - API网关      │◄──►│ - 教授信息     │
│ - 结果展示     │    │ - 意图解析     │    │ - 研究成果     │
│ - 用户管理     │    │ - 匹配算法     │    │ - 项目经历     │
└─────────────────┘    │ - 大语言模型   │    └─────────────────┘
                       └─────────────────┘
```

### 4.2 技术栈选择

#### 4.2.1 前端技术
- **框架**：React + TypeScript
- **UI组件库**：Ant Design
- **状态管理**：Redux Toolkit
- **HTTP客户端**：Axios
- **聊天组件**：自定义聊天界面

#### 4.2.2 后端技术
- **框架**：Node.js + Express 或 Python + FastAPI
- **大语言模型**：OpenAI GPT-4 或 国内大模型（如文心一言、通义千问）
- **向量数据库**：Pinecone 或 Milvus
- **缓存**：Redis
- **消息队列**：RabbitMQ

#### 4.2.3 数据库
- **主数据库**：PostgreSQL
- **向量数据库**：用于存储和检索文本向量
- **缓存数据库**：Redis

#### 4.2.4 部署和运维
- **容器化**：Docker + Docker Compose
- **反向代理**：Nginx
- **监控**：Prometheus + Grafana
- **日志**：ELK Stack

### 4.3 核心算法

#### 4.3.1 意图解析算法
```python
# 伪代码示例
def parse_intent(user_input):
    # 使用大语言模型解析用户意图
    prompt = f"分析以下企业需求，提取技术领域、合作类型、具体要求：{user_input}"
    response = llm.generate(prompt)
    
    # 提取关键信息
    tech_domains = extract_tech_domains(response)
    cooperation_type = extract_cooperation_type(response)
    requirements = extract_requirements(response)
    
    return {
        "tech_domains": tech_domains,
        "cooperation_type": cooperation_type,
        "requirements": requirements
    }
```

#### 4.3.2 匹配算法
```python
# 伪代码示例
def match_professors(intent, professors_data):
    matches = []
    
    for professor in professors_data:
        # 研究方向匹配度
        research_match = calculate_research_match(intent, professor.research_areas)
        
        # 成果相关性
        achievement_match = calculate_achievement_match(intent, professor.achievements)
        
        # 项目经历匹配
        project_match = calculate_project_match(intent, professor.projects)
        
        # 综合评分
        total_score = research_match * 0.4 + achievement_match * 0.4 + project_match * 0.2
        
        if total_score > threshold:
            matches.append({
                "professor": professor,
                "score": total_score,
                "reasons": generate_match_reasons(intent, professor)
            })
    
    return sorted(matches, key=lambda x: x["score"], reverse=True)
```

## 5. 数据模型设计

### 5.1 教授信息表
```sql
CREATE TABLE professors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    title VARCHAR(50),
    department VARCHAR(100),
    research_areas TEXT[],
    email VARCHAR(100),
    office VARCHAR(100),
    phone VARCHAR(20),
    introduction TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.2 研究成果表
```sql
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    professor_id INTEGER REFERENCES professors(id),
    type VARCHAR(20), -- 'paper', 'patent', 'award'
    title VARCHAR(500),
    description TEXT,
    year INTEGER,
    journal VARCHAR(200),
    impact_factor DECIMAL(5,2),
    citations INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 项目经历表
```sql
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    professor_id INTEGER REFERENCES professors(id),
    name VARCHAR(200),
    description TEXT,
    role VARCHAR(50), -- 'principal', 'participant'
    funding_amount DECIMAL(12,2),
    start_date DATE,
    end_date DATE,
    status VARCHAR(20), -- 'ongoing', 'completed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.4 用户查询记录表
```sql
CREATE TABLE query_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    query_text TEXT,
    intent_parsed JSONB,
    matched_professors JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 6. 用户界面设计

### 6.1 主要页面

#### 6.1.1 聊天界面
- **聊天窗口**：类似ChatGPT的对话界面
- **输入框**：支持多行文本输入
- **发送按钮**：提交查询请求
- **加载状态**：显示匹配进度

#### 6.1.2 结果展示页面
- **匹配列表**：按匹配度排序的教授列表
- **教授卡片**：包含基本信息和匹配理由
- **详细信息**：点击展开查看详细成果和项目
- **筛选器**：按研究方向、职称等筛选

#### 6.1.3 教授详情页面
- **基本信息**：姓名、职称、院系、联系方式
- **研究方向**：主要研究领域和专长
- **代表性成果**：重要论文、专利、获奖
- **项目经历**：主持或参与的项目
- **联系方式**：邮箱、办公室、电话

### 6.2 交互流程
1. **用户输入需求**：在聊天界面输入合作需求
2. **AI解析意图**：系统自动解析技术领域和合作类型
3. **需求澄清**：当需求模糊时，AI主动提问引导用户明确需求
4. **智能匹配**：基于解析结果匹配相关教授
5. **结果展示**：展示匹配的教授列表和匹配理由
6. **追问建议**：提供3-5个相关的追问建议，引导用户深入交流
7. **详细信息**：用户可查看教授详细信息或特定科研成果
8. **进一步沟通**：获取联系方式进行合作洽谈

## 7. 实现计划

### 7.1 开发阶段

#### 第一阶段：基础架构（4周）
- 搭建前后端基础架构
- 设计数据库结构
- 实现用户注册登录功能
- 完成基础UI界面

#### 第二阶段：核心功能（6周）
- 集成大语言模型API
- 实现意图解析算法
- 开发匹配算法
- 完成聊天界面

#### 第三阶段：数据管理（4周）
- 开发教授信息管理后台
- 实现数据导入功能
- 建立数据更新机制
- 完成结果展示页面

#### 第四阶段：优化完善（4周）
- 性能优化
- 用户体验优化
- 功能测试和bug修复
- 部署上线

### 7.2 技术难点与解决方案

#### 7.2.1 意图解析准确性
- **问题**：用户需求描述多样，意图解析可能不准确
- **解决方案**：
  - 使用高质量的训练数据
  - 实现多轮对话澄清机制
  - 提供意图确认功能
  - 对模糊需求主动提问引导
  - 提供追问建议，引导用户表达更具体需求

#### 7.2.2 匹配算法效果
- **问题**：如何准确评估教授与需求的匹配度
- **解决方案**：
  - 多维度评分算法
  - 基于历史数据的算法优化
  - 用户反馈机制

#### 7.2.3 数据质量保证
- **问题**：教授信息需要及时更新
- **解决方案**：
  - 建立数据更新流程
  - 自动化数据采集
  - 数据质量监控

## 8. 风险评估

### 8.1 技术风险
- **大语言模型API稳定性**：选择可靠的API提供商，建立备用方案
- **数据安全**：实施严格的数据安全措施
- **系统性能**：进行充分的性能测试和优化

### 8.2 业务风险
- **数据准确性**：建立数据验证机制
- **用户接受度**：通过用户测试收集反馈
- **竞争风险**：持续优化产品功能和用户体验

## 9. 成功指标

### 9.1 技术指标
- **响应时间**：查询响应时间 < 3秒
- **匹配准确率**：用户满意度 > 80%
- **系统可用性**：99.9%以上

### 9.2 业务指标
- **用户活跃度**：月活跃用户数
- **匹配成功率**：成功建立合作的匹配比例
- **用户满意度**：用户反馈评分

## 10. 后续规划

### 10.1 功能扩展
- **多语言支持**：支持英文等其他语言
- **移动端应用**：开发手机APP
- **API开放**：提供API供第三方集成

### 10.2 数据扩展
- **更多高校**：扩展到其他高校
- **更多数据类型**：增加更多类型的科研成果
- **实时更新**：实现数据的实时更新

### 10.3 智能化提升
- **个性化推荐**：基于用户历史行为个性化推荐
- **预测分析**：预测合作成功概率
- **智能客服**：提供更智能的客服支持
- **高级对话能力**：增强对复杂科研问题的理解和回答能力
- **多模态交互**：支持图表、论文摘要等多模态内容的展示和理解
- **自动学习机制**：从用户交互中不断优化匹配算法和对话策略

---

*本文档为智能科研匹配Agent的产品需求文档，将根据实际开发情况进行调整和完善。*

*需要：服务器，域名，API的钱，数据库和数据，完成MVP后软件学长的帮助*
*时间安排：本周开发完demo+找服务器等，下周可找学长把demo部署到服务器上。*
*阿里云服务器68元/年，.cn域名一年38元，贵倒是不贵*
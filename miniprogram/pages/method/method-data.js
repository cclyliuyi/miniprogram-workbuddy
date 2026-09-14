// 图解新版；编辑源与生成记录见 tools/content-v2。
const CARDS = [
  {
    "id": "v2-m01",
    "number": 1,
    "title": "经验可以换一种表达",
    "stage": "重新认识专业能力",
    "subtitle": "迁移方法，不必推倒重来",
    "coreQuestion": "多年电子信息经验，在 AI 时代还能用在哪里？",
    "coreProposition": "你熟悉的建模、实验、误差和权衡，能转化为定义任务、检查证据和判断结果的能力。",
    "exercise": "把一个你擅长的问题写成“输入、目标、约束、怎么验收”四句话。",
    "misconception": "经验需要重新检验适用条件；不要把类比当成两个领域严格等价。",
    "philosophy": "迁移方法，不必推倒重来",
    "keywords": [
      "重新认识专业能力"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m01.webp",
    "sources": [
      {
        "label": "Anthropic · Building effective agents（2024）",
        "url": "https://www.anthropic.com/engineering/building-effective-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "系统建模：把复杂对象写成输入、输出、约束与评价量。专业经验可以先转成清楚的任务定义。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "你熟悉的建模、实验、误差和权衡，能转化为定义任务、检查证据和判断结果的能力。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m02",
    "number": 2,
    "title": "先定义问题，再提问",
    "stage": "重新认识专业能力",
    "subtitle": "把需求写成可判断的问题",
    "coreQuestion": "为什么一句“帮我优化”常得不到可用结果？",
    "coreProposition": "像建立电磁模型一样，先写清对象、激励、约束和观测量，再让 AI 处理。任务描述应让别人也能判断是否完成。",
    "exercise": "让 AI 比较两种天线方案前，先明确频段、尺寸、效率、成本与交付格式。",
    "misconception": "指令越长并不必然越好；缺少关键条件和堆砌无关条件都会带来偏差。",
    "philosophy": "把需求写成可判断的问题",
    "keywords": [
      "重新认识专业能力"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m02.webp",
    "sources": [
      {
        "label": "Anthropic · Effective context engineering（2025）",
        "url": "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
      },
      {
        "label": "Anthropic · Writing tools for agents（2025）",
        "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "电磁建模：对象、激励、边界条件和观测量不清楚，求解结果就难以解释。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "像建立电磁模型一样，先写清对象、激励、约束和观测量，再让 AI 处理。任务描述应让别人也能判断是否完成。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m03",
    "number": 3,
    "title": "信号思维整理上下文",
    "stage": "重新认识专业能力",
    "subtitle": "让关键证据更突出",
    "coreQuestion": "给 AI 的资料越多，回答就越可靠吗？",
    "coreProposition": "借用信号处理的直觉，先筛选与任务相关、来源可靠、版本明确的材料。上下文要让关键证据容易被找到。",
    "exercise": "为一次方案评审准备一页约束、三份核心资料和明确的版本日期。",
    "misconception": "“上下文信噪比”是工程类比，不是可以直接套用通信容量公式的量。",
    "philosophy": "让关键证据更突出",
    "keywords": [
      "重新认识专业能力"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m03.webp",
    "sources": [
      {
        "label": "Anthropic · Effective context engineering（2025）",
        "url": "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "信号处理：围绕任务保留有效成分，辨别噪声、冗余和来源差异。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "借用信号处理的直觉，先筛选与任务相关、来源可靠、版本明确的材料。上下文要让关键证据容易被找到。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m04",
    "number": 4,
    "title": "模型要标清适用范围",
    "stage": "重新认识专业能力",
    "subtitle": "先看假设，再看结论",
    "coreQuestion": "为什么 AI 的答案换个条件就不成立？",
    "coreProposition": "你熟悉模型假设与适用范围。使用 AI 时同样要区分事实、假设、估计和建议，检查它是否跨出了证据边界。",
    "exercise": "要求一份计算结论分别列出“已知条件、采用假设、不适用情形”。",
    "misconception": "模型自述“有把握”不构成校准置信度，也不能代替验证。",
    "philosophy": "先看假设，再看结论",
    "keywords": [
      "重新认识专业能力"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m04.webp",
    "sources": [
      {
        "label": "NIST AI 600-1 · 生成式 AI 风险管理（2024）",
        "url": "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "模型近似：远场、线性、小信号等条件决定一个结论能用在哪里。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "你熟悉模型假设与适用范围。使用 AI 时同样要区分事实、假设、估计和建议，检查它是否跨出了证据边界。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m05",
    "number": 5,
    "title": "测量思维核验结果",
    "stage": "测量与反馈",
    "subtitle": "用外部证据检验输出",
    "coreQuestion": "怎么知道 AI 输出真的可用？",
    "coreProposition": "像校验仪器一样，使用已知答案、独立计算或原始记录验证结果。漂亮的解释与正确的输出是两回事。",
    "exercise": "拿三个你已知答案的典型案例，让 AI 完成并逐项核对。",
    "misconception": "再次询问同一个模型可能重复相同错误，不能当成独立证据。",
    "philosophy": "用外部证据检验输出",
    "keywords": [
      "测量与反馈"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m05.webp",
    "sources": [
      {
        "label": "NIST AI 600-1 · 生成式 AI 风险管理（2024）",
        "url": "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence"
      },
      {
        "label": "Anthropic · Writing tools for agents（2025）",
        "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "测量校准：用参考量和独立手段检查读数，区分精密、准确与看起来合理。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "像校验仪器一样，使用已知答案、独立计算或原始记录验证结果。漂亮的解释与正确的输出是两回事。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m06",
    "number": 6,
    "title": "误差预算找到薄弱环节",
    "stage": "测量与反馈",
    "subtitle": "先定位误差，再换工具",
    "coreQuestion": "出错时，究竟是资料、推理还是工具的问题？",
    "coreProposition": "把整条工作过程拆成来源、提取、计算和表达，逐段定位误差。不要只用“模型不够聪明”概括所有失败。",
    "exercise": "复盘一次错误：原文读错、单位换错、公式选错，还是结论写过头？",
    "misconception": "误差来源可能相互影响，不能总用简单相加替代实际分析。",
    "philosophy": "先定位误差，再换工具",
    "keywords": [
      "测量与反馈"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m06.webp",
    "sources": [
      {
        "label": "Anthropic · Writing tools for agents（2025）",
        "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "误差分析：沿处理链定位来源，优先解决主导误差，而非盲目提高每一环节的精度。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "把整条工作过程拆成来源、提取、计算和表达，逐段定位误差。不要只用“模型不够聪明”概括所有失败。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m07",
    "number": 7,
    "title": "闭环让协作可修正",
    "stage": "测量与反馈",
    "subtitle": "行动之后，要有真实反馈",
    "coreQuestion": "一次提示没有成功，下一步怎样改？",
    "coreProposition": "借用闭环控制思维：先定义目标，执行后观察差距，再根据真实结果修正。每轮改一个关键因素，更容易归因。",
    "exercise": "让 AI 生成一版报告，用明确检查表指出缺口，再只修改最关键的问题。",
    "misconception": "自然语言系统不是已知线性控制对象；不能未经分析照搬稳定性公式。",
    "philosophy": "行动之后，要有真实反馈",
    "keywords": [
      "测量与反馈"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m07.webp",
    "sources": [
      {
        "label": "Anthropic · Building effective agents（2024）",
        "url": "https://www.anthropic.com/engineering/building-effective-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "反馈控制：观察目标与实际结果的差距，再决定下一步调整。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "借用闭环控制思维：先定义目标，执行后观察差距，再根据真实结果修正。每轮改一个关键因素，更容易归因。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m08",
    "number": 8,
    "title": "观测过程，才能诊断",
    "stage": "测量与反馈",
    "subtitle": "留下证据，而不只留答案",
    "coreQuestion": "长任务只给最终答案，为什么很难信任？",
    "coreProposition": "保留关键输入、工具结果、版本和中间产物，让过程可检查、失败可定位。重点是外部执行证据。",
    "exercise": "在一次数据分析中保留原始文件、计算脚本、关键图表与结论对应关系。",
    "misconception": "可追溯记录不等于模型内部思维；无需索取隐藏推理也能审计结果。",
    "philosophy": "留下证据，而不只留答案",
    "keywords": [
      "测量与反馈"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m08.webp",
    "sources": [
      {
        "label": "Anthropic · Writing tools for agents（2025）",
        "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "系统诊断：关键节点有记录，才容易从异常现象追到问题环节。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "保留关键输入、工具结果、版本和中间产物，让过程可检查、失败可定位。重点是外部执行证据。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m09",
    "number": 9,
    "title": "约束比愿望更可执行",
    "stage": "约束与实验",
    "subtitle": "边界既要说清，也要落实",
    "coreQuestion": "怎样让 AI 知道哪些操作不能做？",
    "coreProposition": "像工程边界条件一样明确可操作范围；实际权限由系统和工具限制。只读检查、可逆修改与对外发布应区别处理。",
    "exercise": "把“先分析，不发邮件，不改原始数据”落实为工具权限和副本工作区。",
    "misconception": "提示词中的禁止语句不能替代真实权限控制或隔离。",
    "philosophy": "边界既要说清，也要落实",
    "keywords": [
      "约束与实验"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m09.webp",
    "sources": [
      {
        "label": "NIST AI 600-1 · 生成式 AI 风险管理（2024）",
        "url": "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "工程约束：设计必须满足可行域，约束需要由实际机制落实。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "像工程边界条件一样明确可操作范围；实际权限由系统和工具限制。只读检查、可逆修改与对外发布应区别处理。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m10",
    "number": 10,
    "title": "优化要承认多目标",
    "stage": "约束与实验",
    "subtitle": "先定优先级，再谈最优",
    "coreQuestion": "快、便宜、可靠，怎样做取舍？",
    "coreProposition": "电子信息设计常在性能、成本、体积与功耗之间权衡。AI 工作同样要明确质量、时延、费用和人工复核成本。",
    "exercise": "比较两个工作流程时，同时记录正确率、耗时、费用与返工次数。",
    "misconception": "不要用一个总分掩盖关键失败，也不要默认更大模型对每个任务都更好。",
    "philosophy": "先定优先级，再谈最优",
    "keywords": [
      "约束与实验"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m10.webp",
    "sources": [
      {
        "label": "Anthropic · Building effective agents（2024）",
        "url": "https://www.anthropic.com/engineering/building-effective-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "多目标设计：性能、功耗和成本常常互相制约，最优取决于任务优先级。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "电子信息设计常在性能、成本、体积与功耗之间权衡。AI 工作同样要明确质量、时延、费用和人工复核成本。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m11",
    "number": 11,
    "title": "用对照实验改进流程",
    "stage": "约束与实验",
    "subtitle": "改进要经得起对照",
    "coreQuestion": "新提示词看起来更好，真的更好吗？",
    "coreProposition": "保留固定测试案例，在相同条件下比较两种做法，统计成功与失败类型。区分开发时反复调试的案例和未见过的验收案例。",
    "exercise": "准备十个常见任务，比较加不加资料检索对结果的影响。",
    "misconception": "十个案例只是起点；小样本不能证明普遍有效，模型随机性也要考虑。",
    "philosophy": "改进要经得起对照",
    "keywords": [
      "约束与实验"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m11.webp",
    "sources": [
      {
        "label": "Anthropic · Writing tools for agents（2025）",
        "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "对照实验：保持其他条件尽量一致，考察某项改变是否真正改善结果。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "保留固定测试案例，在相同条件下比较两种做法，统计成功与失败类型。区分开发时反复调试的案例和未见过的验收案例。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m12",
    "number": 12,
    "title": "把失败变成检查项",
    "stage": "约束与实验",
    "subtitle": "经验沉淀为可重复的检查",
    "coreQuestion": "同一种错误为什么总会重来？",
    "coreProposition": "可靠性工程重视失效模式。把真实失败整理成检查清单、边界样例和回归任务，比只保存成功提示词更有价值。",
    "exercise": "把“频率单位混用”写成每次计算前必须验证的一项，并加入测试样例。",
    "misconception": "检查项应来自任务风险与历史失败，不是越长越好。",
    "philosophy": "经验沉淀为可重复的检查",
    "keywords": [
      "约束与实验"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m12.webp",
    "sources": [
      {
        "label": "Anthropic · Writing tools for agents（2025）",
        "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "可靠性分析：记录失效模式，用检查与复测防止同一错误反复发生。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "可靠性工程重视失效模式。把真实失败整理成检查清单、边界样例和回归任务，比只保存成功提示词更有价值。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m13",
    "number": 13,
    "title": "先做好一个小工作流",
    "stage": "在真实工作中迁移",
    "subtitle": "从可验收的小任务开始",
    "coreQuestion": "一定要从自主 Agent 开始吗？",
    "coreProposition": "选一个边界清楚的重复任务，从人能检查的步骤开始：资料整理、计算、结果复核。确有需要时再增加自主决策。",
    "exercise": "先让 AI 整理测试记录并生成待核对摘要，不直接替你作最终技术承诺。",
    "misconception": "工作流和自主 Agent 各有适用情形，自主性增加也会增加检查与恢复成本。",
    "philosophy": "从可验收的小任务开始",
    "keywords": [
      "在真实工作中迁移"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m13.webp",
    "sources": [
      {
        "label": "Anthropic · Building effective agents（2024）",
        "url": "https://www.anthropic.com/engineering/building-effective-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "分级调试：先让一个小系统稳定可用，再增加模块与复杂度。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "选一个边界清楚的重复任务，从人能检查的步骤开始：资料整理、计算、结果复核。确有需要时再增加自主决策。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m14",
    "number": 14,
    "title": "让知识成为可用资源",
    "stage": "在真实工作中迁移",
    "subtitle": "把隐性经验写成可查证的资料",
    "coreQuestion": "多年经验怎样交给 AI 使用？",
    "coreProposition": "把常见问题、参数范围、判断依据和典型失败整理成带来源的资料。资料通过检索提供给任务，重要决策仍由人核验。",
    "exercise": "把最熟悉的一个专题整理成“问题—证据—判断—例外”四栏笔记。",
    "misconception": "把文件放进知识库不等于模型学会了；检索质量、版本和授权仍要管理。",
    "philosophy": "把隐性经验写成可查证的资料",
    "keywords": [
      "在真实工作中迁移"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m14.webp",
    "sources": [
      {
        "label": "Anthropic · Effective context engineering（2025）",
        "url": "https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "工程知识管理：记录参数、条件、依据和例外，使经验可以复用和核查。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "把常见问题、参数范围、判断依据和典型失败整理成带来源的资料。资料通过检索提供给任务，重要决策仍由人核验。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m15",
    "number": 15,
    "title": "保留专业判断的位置",
    "stage": "在真实工作中迁移",
    "subtitle": "把经验放在关键判断处",
    "coreQuestion": "AI 做得越来越多，人还负责什么？",
    "coreProposition": "让 AI 承担检索、草拟和重复计算，把领域判断用于识别异常、确认约束、解释取舍和承担最终责任。",
    "exercise": "审阅一份 AI 方案时，先检查最可能违背物理或工程条件的地方。",
    "misconception": "年龄与既有经验并不决定能否适应；需要改变的是具体工作习惯，而非否定过去。",
    "philosophy": "把经验放在关键判断处",
    "keywords": [
      "在真实工作中迁移"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m15.webp",
    "sources": [
      {
        "label": "NIST AI 600-1 · 生成式 AI 风险管理（2024）",
        "url": "https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "工程判断：识别异常、核对物理边界，并对最终技术决定负责。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "让 AI 承担检索、草拟和重复计算，把领域判断用于识别异常、确认约束、解释取舍和承担最终责任。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  },
  {
    "id": "v2-m16",
    "number": 16,
    "title": "用一个真实任务完成迁移",
    "stage": "在真实工作中迁移",
    "subtitle": "一次可验证的改进，就是起点",
    "coreQuestion": "怎样开始，才不会只停留在学工具？",
    "coreProposition": "选择低风险、可验证的真实任务，记录原流程基线；用 AI 完成一轮，比较质量与耗时，保留有效步骤，修正失败环节。",
    "exercise": "本周选一次测试报告整理：先独立做一份基线，再用 AI 辅助，记录差异并复核结论。",
    "misconception": "一次成功不代表可无人值守；扩大范围前要检查不同案例和失败恢复。",
    "philosophy": "一次可验证的改进，就是起点",
    "keywords": [
      "在真实工作中迁移"
    ],
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/method/m16.webp",
    "sources": [
      {
        "label": "Anthropic · Building effective agents（2024）",
        "url": "https://www.anthropic.com/engineering/building-effective-agents"
      },
      {
        "label": "Anthropic · Writing tools for agents（2025）",
        "url": "https://www.anthropic.com/engineering/writing-tools-for-agents"
      }
    ],
    "sections": [
      {
        "label": "你熟悉的方法",
        "text": "原型验证：先做一个可测量的小实验，再用结果决定是否扩大应用。"
      },
      {
        "label": "迁移到 AI 协作",
        "text": "选择低风险、可验证的真实任务，记录原流程基线；用 AI 完成一轮，比较质量与耗时，保留有效步骤，修正失败环节。"
      }
    ],
    "exerciseLabel": "在工作中试一次"
  }
];
module.exports = { CARDS };

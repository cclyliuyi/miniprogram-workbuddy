// 图解新版；编辑源与生成记录见 tools/content-v2。
const CARDS = [
  {
    "id": "v2-e01",
    "number": 1,
    "title": "从电磁场到信号",
    "stage": "口径与观测",
    "subtitle": "天线是场与信号的接口",
    "coreQuestion": "入射电磁场怎样成为接收机能处理的量？",
    "knownConcept": "天线把入射场耦合为端口电压或电流；接收机观察到的是经过天线与电路响应后的信号。",
    "frontierConcept": "观察量由方向、极化、频率和匹配共同决定。",
    "oneSentence": "天线是场与信号的接口",
    "misconception": "不要把穿过任意几何表面的功率积分直接等同于天线可用接收功率。",
    "exercise": "同一入射场换一副天线，端口信号是否相同？",
    "tags": [
      "口径与观测"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e01.webp",
    "sources": [
      {
        "label": "MIT · Electromagnetics and Applications，天线与口径",
        "url": "https://ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/d3be4ea78b036a6362230fb41780cf54_MIT6_013S09_notes.pdf"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "天线把入射场耦合为端口电压或电流；接收机观察到的是经过天线与电路响应后的信号。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "观察量由方向、极化、频率和匹配共同决定。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e02",
    "number": 2,
    "title": "口径决定看得多细",
    "stage": "口径与观测",
    "subtitle": "更大口径，通常更细分辨",
    "coreQuestion": "为什么更大的口径能分辨更接近的方向？",
    "knownConcept": "口径上的空间相位差提供方向线索。波长一定时，更大的有效观测范围通常能形成更窄的角响应。",
    "frontierConcept": "先建立空间分辨能力，再问可以区分多少模式。",
    "oneSentence": "更大口径，通常更细分辨",
    "misconception": "角分辨率与口径尺寸、照明方式有关，不能只看面积数值。",
    "exercise": "保持波长不变，把线口径加倍，主瓣宽度会怎样变化？",
    "tags": [
      "口径与观测"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e02.webp",
    "sources": [
      {
        "label": "MIT · Electromagnetics and Applications，天线与口径",
        "url": "https://ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/d3be4ea78b036a6362230fb41780cf54_MIT6_013S09_notes.pdf"
      },
      {
        "label": "Poon、Brodersen、Tse · 多天线信道自由度（2005）",
        "url": "https://doi.org/10.1109/TIT.2004.840892"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "口径上的空间相位差提供方向线索。波长一定时，更大的有效观测范围通常能形成更窄的角响应。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "先建立空间分辨能力，再问可以区分多少模式。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e03",
    "number": 3,
    "title": "有效口径不是面积",
    "stage": "口径与观测",
    "subtitle": "几何尺寸还要经过耦合",
    "coreQuestion": "天线画得更大，就一定接收更多功率吗？",
    "knownConcept": "有效口径描述接收能力，几何面积描述实体尺寸。在匹配、方向和极化条件合适时，可用接收功率与入射功率密度及有效口径关联。",
    "frontierConcept": "增益、有效口径和效率把几何结构连接到链路能量。",
    "oneSentence": "几何尺寸还要经过耦合",
    "misconception": "有效口径不等于任意天线的几何面积；失配与极化失配要另外说明。",
    "exercise": "比较两副面积相同、效率不同的天线，它们的可用功率会一样吗？",
    "tags": [
      "口径与观测"
    ],
    "keyFormula": "Aₑ = λ²G / (4π)",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e03.webp",
    "sources": [
      {
        "label": "MIT · Electromagnetics and Applications，天线与口径",
        "url": "https://ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/d3be4ea78b036a6362230fb41780cf54_MIT6_013S09_notes.pdf"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "有效口径描述接收能力，几何面积描述实体尺寸。在匹配、方向和极化条件合适时，可用接收功率与入射功率密度及有效口径关联。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "增益、有效口径和效率把几何结构连接到链路能量。"
      }
    ],
    "exerciseLabel": "想一想",
    "formulaNote": "对互易天线，在同一方向、极化匹配与共轭匹配条件下成立。G 为线性增益，λ 为波长；Aₑ 是有效口径，不是任意几何面积。"
  },
  {
    "id": "v2-e04",
    "number": 4,
    "title": "口径上的相位地图",
    "stage": "口径与观测",
    "subtitle": "看空间结构，也看总功率",
    "coreQuestion": "为什么同一束波在阵列各位置的相位不同？",
    "knownConcept": "不同位置的传播路程造成相位差。阵列利用这些相位关系估计来波方向，并通过相干合成增强选定方向。",
    "frontierConcept": "信息保存在空间变化中，而不只在总接收功率里。",
    "oneSentence": "看空间结构，也看总功率",
    "misconception": "相位分布取决于波前、参考相位和频率；相位图并非信息量的直接读数。",
    "exercise": "两束总功率相同、入射方向不同的波，相位地图有何区别？",
    "tags": [
      "口径与观测"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e04.webp",
    "sources": [
      {
        "label": "MIT · Electromagnetics and Applications，天线与口径",
        "url": "https://ocw.mit.edu/courses/6-013-electromagnetics-and-applications-spring-2009/d3be4ea78b036a6362230fb41780cf54_MIT6_013S09_notes.pdf"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "不同位置的传播路程造成相位差。阵列利用这些相位关系估计来波方向，并通过相干合成增强选定方向。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "信息保存在空间变化中，而不只在总接收功率里。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e05",
    "number": 5,
    "title": "传播把空间连起来",
    "stage": "传播与散射",
    "subtitle": "信道由物理环境塑造",
    "coreQuestion": "从发射电流到接收场，中间发生了什么？",
    "knownConcept": "传播响应把源区的电流分布映射到观测区的电磁场。环境中的材料、边界和几何都会改变这项映射。",
    "frontierConcept": "格林函数或传播算子让电磁模型与信道模型相接。",
    "oneSentence": "信道由物理环境塑造",
    "misconception": "传播不是只有距离衰减；偏振变化、遮挡和反射也影响观测。",
    "exercise": "保持天线不变，在路径中加入一面墙，改变的是哪一部分？",
    "tags": [
      "传播与散射"
    ],
    "keyFormula": "y = Hx + n",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e05.webp",
    "sources": [
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "传播响应把源区的电流分布映射到观测区的电磁场。环境中的材料、边界和几何都会改变这项映射。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "格林函数或传播算子让电磁模型与信道模型相接。"
      }
    ],
    "exerciseLabel": "想一想",
    "formulaNote": "在线性离散模型中，x 是发射激励，y 是接收观测，H 汇集天线与传播响应，n 表示噪声。连续场模型则用传播算子描述。"
  },
  {
    "id": "v2-e06",
    "number": 6,
    "title": "多径带来不同视角",
    "stage": "传播与散射",
    "subtitle": "多径的价值取决于可区分性",
    "coreQuestion": "多径只能造成衰落吗？",
    "knownConcept": "直达、反射和散射分量以不同方向、时延与相位到达接收端；它们可能提供可区分的观测，也可能相互抵消。",
    "frontierConcept": "能分开的路径结构可以成为空间或时延多样性的资源。",
    "oneSentence": "多径的价值取决于可区分性",
    "misconception": "多径条数不等于独立数据流数，相关性和接收分辨能力同样重要。",
    "exercise": "把两条到达方向几乎相同的路径与方向相差很大的路径比较。",
    "tags": [
      "传播与散射"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e06.webp",
    "sources": [
      {
        "label": "Poon、Brodersen、Tse · 多天线信道自由度（2005）",
        "url": "https://doi.org/10.1109/TIT.2004.840892"
      },
      {
        "label": "复杂空间中 MIMO 的电磁信息论建模（2023）",
        "url": "https://arxiv.org/abs/2301.05536"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "直达、反射和散射分量以不同方向、时延与相位到达接收端；它们可能提供可区分的观测，也可能相互抵消。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "能分开的路径结构可以成为空间或时延多样性的资源。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e07",
    "number": 7,
    "title": "富散射与空间自由度",
    "stage": "传播与散射",
    "subtitle": "可分辨的多径，支持空间复用",
    "coreQuestion": "为什么富散射环境能为 MIMO 通信带来更多空间自由度？",
    "knownConcept": "富散射指环境提供丰富的散射传播分量。若这些分量在收发阵列上形成可分辨、相关性较低的空间响应，就能支持更多独立空间通道，让多路数据在同一时频资源上传输。",
    "frontierConcept": "相对于空间通道退化的环境，富散射可提高信道秩与空间复用自由度。收益取决于收发口径、出发与到达角分布，以及模式的独立性；有限信噪比下还要看弱模式能否使用。",
    "oneSentence": "可分辨的多径，支持空间复用",
    "misconception": "富散射不等于多重散射：前者强调传播分量的丰富性，后者强调电波经历多次散射。路径多不保证满秩，强相关或钥孔效应仍可能限制自由度。",
    "exercise": "同样是两发两收，两条路径的空间响应几乎相同，和两条可分辨路径相比，能独立传几路数据？",
    "tags": [
      "传播与散射"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e07-rich-scattering.webp",
    "sources": [
      {
        "label": "Tse 与 Viswanath · 无线通信基础，第 7 章：MIMO 空间复用",
        "url": "https://web.stanford.edu/~dntse/Chapters_PDF/Fundamentals_Wireless_Communication_chapter7.pdf"
      },
      {
        "label": "Poon、Brodersen、Tse · 多天线信道自由度（2005）",
        "url": "https://doi.org/10.1109/TIT.2004.840892"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "富散射指环境提供丰富的散射传播分量。若这些分量在收发阵列上形成可分辨、相关性较低的空间响应，就能支持更多独立空间通道，让多路数据在同一时频资源上传输。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "相对于空间通道退化的环境，富散射可提高信道秩与空间复用自由度。收益取决于收发口径、出发与到达角分布，以及模式的独立性；有限信噪比下还要看弱模式能否使用。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e08",
    "number": 8,
    "title": "散射丰富不等于容量高",
    "stage": "传播与散射",
    "subtitle": "既要分得开，也要收得到",
    "coreQuestion": "富散射增加空间自由度，为什么容量仍要单独评估？",
    "knownConcept": "富散射可以拓宽角谱、改善空间通道的独立性，为 MIMO 提供自由度收益。但额外路径也可能较弱或有较大损耗；在有限总功率和噪声条件下，容量还取决于各模式的信噪比与功率分配。",
    "frontierConcept": "同时看独立性和能量，才能判断多径的通信价值。",
    "oneSentence": "既要分得开，也要收得到",
    "misconception": "不能在固定总功率与噪声条件之外，笼统断言散射越多越好。",
    "exercise": "两条弱但独立的通道与一条强通道，哪个更好？还缺什么条件？",
    "tags": [
      "传播与散射"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e08.webp",
    "sources": [
      {
        "label": "Tse 与 Viswanath · 无线通信基础，第 7 章：MIMO 空间复用",
        "url": "https://web.stanford.edu/~dntse/Chapters_PDF/Fundamentals_Wireless_Communication_chapter7.pdf"
      },
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "富散射可以拓宽角谱、改善空间通道的独立性，为 MIMO 提供自由度收益。但额外路径也可能较弱或有较大损耗；在有限总功率和噪声条件下，容量还取决于各模式的信噪比与功率分配。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "同时看独立性和能量，才能判断多径的通信价值。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e09",
    "number": 9,
    "title": "近场多了距离线索",
    "stage": "传播与散射",
    "subtitle": "波前曲率携带距离线索",
    "coreQuestion": "近场为什么不能只用到达角描述？",
    "knownConcept": "大口径附近的球面波前曲率不可忽略。同一方向、不同距离的源，可能在口径上留下不同相位结构。",
    "frontierConcept": "距离聚焦与角度选择一起影响可分辨的空间模式。",
    "oneSentence": "波前曲率携带距离线索",
    "misconception": "近场不自动保证更多有效自由度；还受口径、距离、波长、噪声与耦合限制。",
    "exercise": "两个用户在同一方向不同距离，何时仍可能被区分？",
    "tags": [
      "传播与散射"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e09.webp",
    "sources": [
      {
        "label": "连续口径视角的电磁信号与信息论（2026 预印本）",
        "url": "https://arxiv.org/abs/2605.12910"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "大口径附近的球面波前曲率不可忽略。同一方向、不同距离的源，可能在口径上留下不同相位结构。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "距离聚焦与角度选择一起影响可分辨的空间模式。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e10",
    "number": 10,
    "title": "模式是独立的表达方式",
    "stage": "模式与自由度",
    "subtitle": "模式把复杂场拆成结构",
    "coreQuestion": "很多测量值为什么可以用较少的模式表达？",
    "knownConcept": "把复杂场分解到一组基函数上，可以分开描述不同空间结构。合适的模式让传输关系更容易理解。",
    "frontierConcept": "模式分解是描述工具；可用模式数还取决于实际传输强度。",
    "oneSentence": "模式把复杂场拆成结构",
    "misconception": "换一套数学基并不会凭空增加物理通道。",
    "exercise": "多个测点高度相关时，是否一定需要同样多个独立模式？",
    "tags": [
      "模式与自由度"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e10.webp",
    "sources": [
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "把复杂场分解到一组基函数上，可以分开描述不同空间结构。合适的模式让传输关系更容易理解。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "模式分解是描述工具；可用模式数还取决于实际传输强度。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e11",
    "number": 11,
    "title": "奇异值看通道强弱",
    "stage": "模式与自由度",
    "subtitle": "独立通道也有强弱之分",
    "coreQuestion": "哪些发射模式能有效到达接收端？",
    "knownConcept": "在适当离散化与功率归一化下，对信道做奇异值分解，可得到配对的发射与接收模式及其传输强度。",
    "frontierConcept": "大奇异值对应较强耦合，小奇异值模式可能淹没在噪声中。",
    "oneSentence": "独立通道也有强弱之分",
    "misconception": "奇异值依赖模型与归一化；模式数和模式强度必须一起看。",
    "exercise": "两个信道秩相同，但奇异值分布不同，性能会一样吗？",
    "tags": [
      "模式与自由度"
    ],
    "keyFormula": "H = UΣVᴴ",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e11.webp",
    "sources": [
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      },
      {
        "label": "复杂空间中 MIMO 的电磁信息论建模（2023）",
        "url": "https://arxiv.org/abs/2301.05536"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "在适当离散化与功率归一化下，对信道做奇异值分解，可得到配对的发射与接收模式及其传输强度。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "大奇异值对应较强耦合，小奇异值模式可能淹没在噪声中。"
      }
    ],
    "exerciseLabel": "想一想",
    "formulaNote": "奇异值分解把线性信道写成模式耦合。Σ 中的奇异值描述强弱；比较不同模型时要统一功率归一化和噪声度量。"
  },
  {
    "id": "v2-e12",
    "number": 12,
    "title": "自由度不是阵元数",
    "stage": "模式与自由度",
    "subtitle": "端口多，不代表独立信息多",
    "coreQuestion": "为什么增加天线数量不一定等比例增加独立信道？",
    "knownConcept": "阵元数描述采样端口数，信道秩描述线性独立性，有效自由度还要指定噪声或阈值。它们回答不同问题。",
    "frontierConcept": "有限口径和环境约束下，过密采样可能主要增加相关观测。",
    "oneSentence": "端口多，不代表独立信息多",
    "misconception": "严格高信噪比自由度、代数秩和有限信噪比有效自由度不可混用。",
    "exercise": "把同一根天线信号复制十份，独立信息增加了吗？",
    "tags": [
      "模式与自由度"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e12.webp",
    "sources": [
      {
        "label": "Poon、Brodersen、Tse · 多天线信道自由度（2005）",
        "url": "https://doi.org/10.1109/TIT.2004.840892"
      },
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "阵元数描述采样端口数，信道秩描述线性独立性，有效自由度还要指定噪声或阈值。它们回答不同问题。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "有限口径和环境约束下，过密采样可能主要增加相关观测。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e13",
    "number": 13,
    "title": "角谱决定可见空间",
    "stage": "模式与自由度",
    "subtitle": "口径与环境共同决定模式",
    "coreQuestion": "口径同样大，为什么不同环境的空间自由度不同？",
    "knownConcept": "有限口径只能分辨有限的空间变化；环境的到达角范围又决定哪些空间频率被有效激励。",
    "frontierConcept": "空间自由度由观测范围与角谱共同限制，而非单独由阵元数决定。",
    "oneSentence": "口径与环境共同决定模式",
    "misconception": "具体自由度公式依赖线阵或面阵、单侧或双侧、极化与波场模型。",
    "exercise": "狭窄角度来波和宽角度来波，在同一阵列上留下的相关性有何不同？",
    "tags": [
      "模式与自由度"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e13.webp",
    "sources": [
      {
        "label": "Poon、Brodersen、Tse · 多天线信道自由度（2005）",
        "url": "https://doi.org/10.1109/TIT.2004.840892"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "有限口径只能分辨有限的空间变化；环境的到达角范围又决定哪些空间频率被有效激励。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "空间自由度由观测范围与角谱共同限制，而非单独由阵元数决定。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e14",
    "number": 14,
    "title": "采得更密，也有边界",
    "stage": "模式与自由度",
    "subtitle": "连续描述不等于无限信息",
    "coreQuestion": "连续口径是否意味着无限可用自由度？",
    "knownConcept": "更密采样能更充分逼近连续场，但相邻端口相关、互耦和接收电路代价会变得重要。可用信息仍受物理和噪声约束。",
    "frontierConcept": "先问空间变化能否被观测，再设计采样与射频实现。",
    "oneSentence": "连续描述不等于无限信息",
    "misconception": "半波长采样并非适用于所有近场与倏逝场问题的万能规则。",
    "exercise": "在固定口径内把阵元间距减半，哪些收益可能饱和？",
    "tags": [
      "模式与自由度"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e14.webp",
    "sources": [
      {
        "label": "连续口径视角的电磁信号与信息论（2026 预印本）",
        "url": "https://arxiv.org/abs/2605.12910"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "更密采样能更充分逼近连续场，但相邻端口相关、互耦和接收电路代价会变得重要。可用信息仍受物理和噪声约束。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "先问空间变化能否被观测，再设计采样与射频实现。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e15",
    "number": 15,
    "title": "噪声决定哪些模式可用",
    "stage": "从场到信息",
    "subtitle": "看得到，才谈得上利用",
    "coreQuestion": "数学上存在的模式，接收机都能使用吗？",
    "knownConcept": "弱模式可能被热噪声、干扰或硬件误差掩盖。有限信噪比下，能可靠区分的模式通常少于数学模型中的全部模式。",
    "frontierConcept": "有效自由度必须说明功率、噪声和判定标准。",
    "oneSentence": "看得到，才谈得上利用",
    "misconception": "噪声可能有空间相关性，不能总当成各端口独立白噪声。",
    "exercise": "降低噪声之后，是产生了新物理模式，还是看见了原本的弱模式？",
    "tags": [
      "从场到信息"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e15.webp",
    "sources": [
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "弱模式可能被热噪声、干扰或硬件误差掩盖。有限信噪比下，能可靠区分的模式通常少于数学模型中的全部模式。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "有效自由度必须说明功率、噪声和判定标准。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e16",
    "number": 16,
    "title": "从接收功率到信息容量",
    "stage": "从场到信息",
    "subtitle": "能量预算之外，还要看模式",
    "coreQuestion": "接收功率相同，能传的信息一定一样吗？",
    "knownConcept": "容量还取决于带宽、噪声、信道模式以及输入功率分配。在理想独立高斯子信道模型下，可按各模式信噪比相加计算频谱效率。",
    "frontierConcept": "由“收到多少能量”转向“能区分多少可靠的输入”。",
    "oneSentence": "能量预算之外，还要看模式",
    "misconception": "不能把模式数直接当成容量；也不能把频谱效率和 bit/s 混为一谈。",
    "exercise": "相同总功率集中在一个模式或分到多个模式，怎样比较？",
    "tags": [
      "从场到信息"
    ],
    "keyFormula": "η = Σᵢ log₂(1 + γᵢ)",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e16.webp",
    "sources": [
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "容量还取决于带宽、噪声、信道模式以及输入功率分配。在理想独立高斯子信道模型下，可按各模式信噪比相加计算频谱效率。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "由“收到多少能量”转向“能区分多少可靠的输入”。"
      }
    ],
    "exerciseLabel": "想一想",
    "formulaNote": "理想独立复高斯子信道、给定功率分配下，γᵢ 为第 i 个模式的信噪比，η 单位为 bit/s/Hz。最大化可行功率分配才得到容量；固定平坦带宽 B 下速率为 Bη。"
  },
  {
    "id": "v2-e17",
    "number": 17,
    "title": "把功率分给合适的模式",
    "stage": "从场到信息",
    "subtitle": "资源分配也是信息问题",
    "coreQuestion": "为什么最弱的模式不一定值得投入功率？",
    "knownConcept": "固定总功率时，把资源分给不同模式会改变总信息率。理想已知信道与高斯噪声条件下，注水思想优先使用条件较好的模式。",
    "frontierConcept": "资源优化建立在物理可达模式之上。",
    "oneSentence": "资源分配也是信息问题",
    "misconception": "注水依赖信道知识、噪声模型与约束；实际还受功放、每端口功率和调制限制。",
    "exercise": "总功率很小时，平均分给所有模式一定最优吗？",
    "tags": [
      "从场到信息"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e17.webp",
    "sources": [
      {
        "label": "复杂空间中 MIMO 的电磁信息论建模（2023）",
        "url": "https://arxiv.org/abs/2301.05536"
      },
      {
        "label": "电磁信息论：基础、建模、应用与开放问题（2022）",
        "url": "https://arxiv.org/abs/2212.02882"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "固定总功率时，把资源分给不同模式会改变总信息率。理想已知信道与高斯噪声条件下，注水思想优先使用条件较好的模式。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "资源优化建立在物理可达模式之上。"
      }
    ],
    "exerciseLabel": "想一想"
  },
  {
    "id": "v2-e18",
    "number": 18,
    "title": "连续口径连接两种理论",
    "stage": "从场到信息",
    "subtitle": "从可辐射的场到可传输的信息",
    "coreQuestion": "电磁信息论最终希望一起回答什么？",
    "knownConcept": "把几何、材料、传播、端口、噪声和信息指标放进一致模型，研究什么信息可传、由哪些模式承载、代价是什么。",
    "frontierConcept": "连续口径阵列与全息 MIMO 是研究方向；实现仍要考虑损耗、互耦、采样和电路。",
    "oneSentence": "从可辐射的场到可传输的信息",
    "misconception": "这是物理约束下的联合建模框架；前沿模型结论不等于已实现的工程性能。",
    "exercise": "设计天线时，除了增益，还应增加哪些与信息有关的评价量？",
    "tags": [
      "从场到信息"
    ],
    "keyFormula": "",
    "status": "final",
    "imageSrc": "cloud://cloud1-d3gsxamaw26beccb8.636c-cloud1-d3gsxamaw26beccb8-1312580783/content-v2-20260914/eit/e18.webp",
    "sources": [
      {
        "label": "连续口径视角的电磁信号与信息论（2026 预印本）",
        "url": "https://arxiv.org/abs/2605.12910"
      }
    ],
    "sections": [
      {
        "label": "从熟悉的概念出发",
        "text": "把几何、材料、传播、端口、噪声和信息指标放进一致模型，研究什么信息可传、由哪些模式承载、代价是什么。"
      },
      {
        "label": "向信息视角迈一步",
        "text": "连续口径阵列与全息 MIMO 是研究方向；实现仍要考虑损耗、互耦、采样和电路。"
      }
    ],
    "exerciseLabel": "想一想"
  }
];
module.exports = { CARDS };

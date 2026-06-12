# 🧠 LangGraph Scene Memory Node — 流程图

## 完整 StateGraph

```mermaid
graph TB
    START((START)) --> planner_node

    planner_node{planner_node<br/>行为规划} -->|vision| vision_node
    planner_node -->|tool| tool_node
    planner_node -->|direct_reason| reasoning_node

    vision_node[👁️ vision_node<br/>视觉场景分析] --> memory_node

    subgraph memory["🧠 memory_node — 场景长期记忆"]
        direction TB
        M1[1️⃣ 接收 vision_context] --> M2[2️⃣ SceneMemoryStore.save<br/>解析场景 + 分类 + 提取物体]
        M2 --> M3[3️⃣ build_scene_context<br/>读取历史 + 压缩 + 聚合]
        M3 --> M4[4️⃣ 输出结构化 scene_memory]
        
        subgraph store["SceneMemoryStore"]
            S1["📦 LRU 队列 (10条)"]
            S2["🏷️ 物体追踪表"]
            S3["📊 场景类型趋势"]
        end
        
        M2 -.-> S1
        M2 -.-> S2
        M3 -.-> S3
    end

    memory_node --> reasoning_node
    tool_node[🔧 tool_node<br/>工具执行] --> reasoning_node

    reasoning_node[🧠 reasoning_node<br/>综合推理] --> response_node
    response_node[💬 response_node<br/>生成回复] --> END((END))

    style memory fill:#1e293b,stroke:#6366f1,stroke-width:3px,color:#e2e8f0
    style store fill:#0f172a,stroke:#06b6d4,stroke-width:2px,stroke-dasharray:5
```

## memory_node 内部流程

```mermaid
flowchart LR
    subgraph input["输入"]
        VC["vision_context<br/>Vision API 返回文本"]
        SID["session_id"]
    end

    subgraph parse["场景解析"]
        P1["JSON 解析<br/>或规则提取"]
        P2["物体提取<br/>去重 + 清理"]
        P3["类型推断<br/>office/outdoor/kitchen/..."]
        P4["变化检测<br/>与上一帧对比"]
    end

    subgraph store["SceneMemoryStore"]
        S1["save() → SceneRecord"]
        S2["LRU 淘汰 >10条"]
        S3["全局物体追踪"]
    end

    subgraph build["构造 SceneContext"]
        B1["当前场景摘要"]
        B2["最近 5 条压缩历史"]
        B3["重要物体聚合 出现≥2次"]
        B4["场景类型趋势"]
        B5["压缩上下文文本"]
    end

    subgraph output["输出"]
        O1["scene_memory<br/>结构化 JSON"]
        O2["agent_scratchpad<br/>记忆日志"]
    end

    VC --> P1
    SID --> S1
    P1 --> P2 --> P3
    P2 --> P4
    P3 --> S1
    P4 --> S1
    S1 --> S2
    S1 --> S3
    S2 --> B1
    S3 --> B3
    S1 --> B2 --> B5
    S3 --> B4 --> B5
    B1 --> B5
    B1 --> O1
    B3 --> O1
    B4 --> O1
    B5 --> O1
    B5 --> O2
```

## 数据结构流转

```mermaid
flowchart TD
    vision_context["vision_context: str<br/>'场景: 办公室。物体: 笔记本电脑, 咖啡杯...'"]
    
    subgraph parse["memory_node 内存"]
        P["_parse_vision_text()"]
    end
    
    SceneRecord["SceneRecord<br/>├─ scene_summary<br/>├─ key_objects: ['笔记本电脑','咖啡杯']<br/>├─ people_count: 1<br/>├─ scene_type: 'office'<br/>└─ change_from_prev: '新增: 咖啡杯'"]
    
    subgraph store["SceneMemoryStore (会话级别)"]
        LRU["_store[session_id]<br/>[rec1, rec2, ..., rec10]"]
        OBJ["_global_objects<br/>OrderedDict<br/>{笔记本电脑: t1, 咖啡杯: t2}"]
    end
    
    SceneContext["SceneContext<br/>├─ current_scene<br/>├─ recent_history: [...]<br/>├─ all_objects: ['笔记本电脑','咖啡杯']<br/>├─ scene_type_trend: 'office → office → coding'<br/>├─ has_changed: True<br/>└─ compressed_context: str"]
    
    scene_memory["scene_memory<br/>[JSON]<br/>{<br/>  'current': '...',<br/>  'important_objects': [...],<br/>  'scene_trend': '...',<br/>  'compressed_context': '...'<br/>}"]
    
    vision_context --> P
    P --> SceneRecord
    SceneRecord --> LRU
    SceneRecord --> OBJ
    LRU --> SceneContext
    OBJ --> SceneContext
    SceneContext --> scene_memory
```

## 示例：10 轮场景记忆演化

```mermaid
gantt
    title 场景记忆时间线 (最近10条)
    dateFormat HH:mm:ss
    axisFormat %H:%M:%S
    
    section 场景类型
    办公场景    :t1, 00:00, 8s
    办公场景    :t2, after t1, 8s
    办公场景    :t3, after t2, 8s
    办公场景    :t4, after t3, 2s
    编码场景    :t5, after t4, 4s
    编码场景    :t6, after t5, 8s
    编码场景    :t7, after t6, 8s
    编码场景    :t8, after t7, 8s
    办公场景    :t9, after t8, 3s
    办公场景    :t10, after t9, 8s
    
    section 重要物体
    laptop      :active, t1, t10
    cup         :active, t1, t5
    coffee      :active, t1, t3
    book        :active, t4, t8
    phone       :active, t9, t10
```

// claude.ai UI translator (English -> Simplified Chinese).
//
// Why this exists:
//   claude.ai's official language picker (Settings → General → Language)
//   does not include Simplified Chinese as of 2026-04. This module
//   approximates it by walking the DOM, replacing UI text nodes whose
//   content matches a hand-curated dictionary, and watching for new
//   nodes via a MutationObserver.
//
// Strict no-touch zones:
//   * The user's own message bubbles  ([data-testid="user-message"])
//   * Claude's response area          (.font-claude-response)
//   * Any textarea / input / contenteditable
//   * <code> / <pre>                  (always treat code as authored)
// These are walked-around so chat content is never mutated.
//
// To extend the dictionary:
//   1. Open DevTools console on claude.ai with translator enabled.
//   2. Look for `[Claude Fixer/zh] untranslated:` lines.
//   3. Add the english key to DICT below with its translation.
//   4. Reload the extension.

(function () {
  const TAG = '[Claude Fixer/zh]';

  // ============================================================
  // DICTIONARY
  // ============================================================
  // Keep brand / model / technical names in English: "Claude",
  // "Opus", "Sonnet", "Haiku", "API", "MCP", "Artifacts", "Tiempos",
  // "Anthropic", etc.
  //
  // Match is on .trim()'d textContent, case-sensitive.

  const DICT = {
    // -- Sidebar / top-level navigation --
    "New chat":                       "新对话",
    "Search":                         "搜索",
    "Search chats":                   "搜索对话",
    "Customize":                      "自定义",
    "Chats":                          "对话",
    "Projects":                       "项目",
    "Artifacts":                      "制品",
    "Artifact":                       "制品",
    "Code":                           "代码",
    "Get apps and extensions":        "获取应用与扩展",
    "Open sidebar":                   "展开侧边栏",
    "Close sidebar":                  "收起侧边栏",
    "Pin sidebar":                    "固定侧边栏",
    "Settings":                       "设置",
    "Home":                           "主页",

    // -- Settings pages --
    "General":                        "通用",
    "Account":                        "账户",
    "Privacy":                        "隐私",
    "Billing":                        "账单",
    "Usage":                          "用量",
    "Capabilities":                   "能力",
    "Connectors":                     "连接器",
    "Claude Code":                    "Claude Code",
    "Profile":                        "个人资料",
    "Appearance":                     "外观",
    "Language":                       "语言",
    "Theme":                          "主题",
    "Light":                          "浅色",
    "Dark":                           "深色",
    "System":                         "跟随系统",

    // -- Profile / preferences card --
    "Randomize avatar":               "随机头像",
    "What best describes your work?": "你的工作领域是？",
    "personal preferences":           "个人偏好",
    "What personal preferences should Claude consider in responses?":
                                      "Claude 在回复时应该考虑哪些个人偏好？",
    "Anthropic's guidelines":         "Anthropic 使用准则",
    "Anthropic’s guidelines":         "Anthropic 使用准则",
    "Full name":                      "全名",
    "What should Claude call you?":   "Claude 应该怎么称呼你？",

    // -- Model selector dropdown --
    "Opus 4.6":                       "Opus 4.6",
    "Sonnet 4.6":                     "Sonnet 4.6",
    "Haiku 4.5":                      "Haiku 4.5",
    "Most capable for ambitious work":"适合高难度工作的最强模型",
    "Extended thinking":              "深度思考",
    "Think longer for complex tasks": "为复杂任务花更多时间思考",
    "More models":                    "更多模型",
    "Smart, efficient model for everyday use":
                                      "日常使用的智能高效模型",
    "Fastest model for daily tasks":  "日常任务最快的模型",

    // -- Composer toolbar / input area --
    "Reply to Claude...":             "回复 Claude...",
    "How can I help you today?":      "今天我能帮你什么？",
    "Message Claude…":                "发消息给 Claude…",
    "Add files, connectors, and more":"添加文件、连接器等",
    "Use voice mode":                 "使用语音模式",
    "Use incognito":                  "无痕模式",
    "Send message":                   "发送消息",
    "Stop generating":                "停止生成",
    "Stop response":                  "停止回复",
    "Attach files":                   "添加附件",

    // -- Common verbs / buttons --
    "Send":                           "发送",
    "Stop":                           "停止",
    "Copy":                           "复制",
    "Copied":                         "已复制",
    "Copied!":                        "已复制！",
    "Delete":                         "删除",
    "Edit":                           "编辑",
    "Save":                           "保存",
    "Cancel":                         "取消",
    "Continue":                       "继续",
    "Confirm":                        "确认",
    "OK":                             "确定",
    "Done":                           "完成",
    "Close":                          "关闭",
    "Retry":                          "重试",
    "Regenerate":                     "重新生成",
    "Share":                          "分享",
    "Rename":                         "重命名",
    "Star":                           "收藏",
    "Unstar":                         "取消收藏",
    "Archive":                        "归档",
    "Unarchive":                      "取消归档",
    "Export":                         "导出",
    "Import":                         "导入",
    "Upload":                         "上传",
    "Download":                       "下载",
    "Submit":                         "提交",
    "Reset":                          "重置",
    "Apply":                          "应用",
    "Add":                            "添加",
    "Remove":                         "移除",
    "Update":                         "更新",
    "Refresh":                        "刷新",
    "Back":                           "返回",
    "Next":                           "下一步",
    "Previous":                       "上一步",
    "Skip":                           "跳过",
    "Learn more":                     "了解更多",
    "Show more":                      "显示更多",
    "Show less":                      "收起",
    "View all":                       "查看全部",

    // -- Conversation list / chat metadata --
    "Today":                          "今天",
    "Yesterday":                      "昨天",
    "This week":                      "本周",
    "Last week":                      "上周",
    "This month":                     "本月",
    "Last month":                     "上个月",
    "Older":                          "更早",
    "Recents":                        "最近",
    "Starred":                        "已收藏",
    "All chats":                      "全部对话",
    "No results":                     "没有结果",
    "No chats yet":                   "还没有对话",

    // -- Message metadata --
    "Thinking":                       "思考中",
    "Thinking…":                      "思考中…",
    "Generating":                     "生成中",
    "Generating…":                    "生成中…",
    "Replying":                       "回复中",
    "Tool use":                       "工具调用",
    "Tools":                          "工具",
    "Sources":                        "来源",
    "Citations":                      "引用",
    "Attachments":                    "附件",

    // -- Plans / billing --
    "Free":                           "免费版",
    "Pro":                            "Pro",
    "Max":                            "Max",
    "Team":                           "团队版",
    "Enterprise":                     "企业版",
    "Upgrade":                        "升级",
    "Manage subscription":            "管理订阅",
    "Current plan":                   "当前套餐",

    // -- Auth / account --
    "Sign in":                        "登录",
    "Sign out":                       "退出登录",
    "Log in":                         "登录",
    "Log out":                        "退出登录",
    "Email":                          "邮箱",
    "Password":                       "密码",
    "Continue with Google":           "使用 Google 继续",

    // -- Errors / status --
    "Something went wrong":           "出了点问题",
    "Try again":                      "重试",
    "Loading":                        "加载中",
    "Loading…":                       "加载中…",
    "Loading...":                     "加载中…",
    "Connection lost":                "连接断开",
    "Reconnecting":                   "重新连接中",
    "You're offline":                 "你当前离线",

    // -- Projects feature --
    "Create project":                 "新建项目",
    "New project":                    "新项目",
    "Project knowledge":              "项目知识库",
    "Add to project":                 "添加到项目",
    "Project description":            "项目描述",
    "Custom instructions":            "自定义指令",

    // -- Capabilities / connectors --
    "Web search":                     "网络搜索",
    "File system":                    "文件系统",
    "Image generation":               "图像生成",
    "Code execution":                 "代码执行",
    "Computer use":                   "电脑操作",
    "Connect":                        "连接",
    "Disconnect":                     "断开连接",
    "Connected":                      "已连接",
    "Disabled":                       "已禁用",
    "Enabled":                        "已启用",

    // ============================================================
    // Auto-generated from probe dump (2026-04-10)
    // ============================================================
    "Activity": "活动",
    "Active sessions": "活跃会话",
    "Add connector": "添加连接器",
    "Add custom connector": "添加自定义连接器",
    "Add files or photos": "添加文件或照片",
    "Add from GitHub": "从 GitHub 添加",
    "Add from Google Drive": "从 Google Drive 添加",
    "Add skill": "添加技能",
    "Add websites": "添加网站",
    "Added by": "添加者",
    "Adjust plan": "调整套餐",
    "Adjust usage": "调整用量",
    "All models": "所有模型",
    "Allow extension": "允许扩展",
    "Allow network egress": "允许网络出站",
    "Always allow": "始终允许",
    "Auto": "自动",
    "Auto background animation": "自动背景动画",
    "Auto color mode": "自动颜色模式",
    "Auto mode preview": "自动模式预览",
    "Autofix pull requests": "自动修复拉取请求",
    "Background animation": "背景动画",
    "Beta": "测试版",
    "Blanket permission for group": "对该分组的总体权限",
    "Blocked": "已屏蔽",
    "Blocked sites": "已屏蔽的站点",
    "Browse connectors": "浏览连接器",
    "Cancel plan": "取消套餐",
    "Cancellation": "取消订阅",
    "Chat font": "聊天字体",
    "Chat search results": "聊天搜索结果",
    "Choose when Claude is allowed to use these tools.": "选择 Claude 何时可以使用这些工具。",
    "Choose whether Claude in Chrome works on all sites by default": "选择 Claude in Chrome 是否默认在所有站点工作",
    "Choose which domains the sandbox can access": "选择沙箱可访问的域名",
    "Claim your credit": "领取你的额度",
    "Claude": "Claude",
    "Claude in Chrome": "Claude in Chrome",
    "Claude in Chrome cannot be used on these sites": "Claude in Chrome 在这些站点不可用",
    "Claude in Chrome settings": "Claude in Chrome 设置",
    "Claude in Chrome works everywhere except sites you block below": "Claude in Chrome 在所有站点工作（你下面屏蔽的除外）",
    "Claude can access common package managers plus any additional domains you specify below.": "Claude 可以访问常见的包管理器，以及你下面指定的任何额外域名。",
    "Code execution and file creation": "代码执行与文件创建",
    "Color mode": "颜色模式",
    "Configure": "配置",
    "Connect your apps": "连接你的应用",
    "Connectors have moved to Customize. Head to the new Customize page to manage your skills and connectors.": "连接器已迁移到「自定义」。前往新的「自定义」页面管理你的技能和连接器。",
    "Connectors like Google Workspace, email, and calendar": "连接器，例如 Google Workspace、邮箱和日历",
    "Control how your claude.ai/code sessions are shared.": "控制你的 claude.ai/code 会话如何被共享。",
    "Controls how connector tools are loaded in new conversations.": "控制新对话中连接器工具的加载方式。",
    "Copy link": "复制链接",
    "Copy organization ID": "复制组织 ID",
    "Copy server URL": "复制服务器 URL",
    "Create new skills": "创建新技能",
    "Created": "已创建",
    "Current": "当前",
    "Current session": "当前会话",
    "Customize Claude": "自定义 Claude",
    "Dark color mode": "深色模式",
    "Dark mode preview": "深色模式预览",
    "Data Privacy Icon": "数据隐私图标",
    "Data science": "数据科学",
    "Deep research and extended thinking": "深度研究与深度思考",
    "Default": "默认",
    "Default chat font": "默认聊天字体",
    "Default for all sites": "所有站点的默认设置",
    "Delete account": "删除账户",
    "Description": "描述",
    "Design": "设计",
    "Device": "设备",
    "Dialog": "对话框",
    "Disabled background animation": "已禁用背景动画",
    "Dispatch messages": "Dispatch 消息",
    "Domain allowlist": "域名白名单",
    "Downgrade to Pro": "降级到 Pro",
    "Dyslexic friendly": "阅读障碍友好",
    "Dyslexic friendly chat font": "阅读障碍友好聊天字体",
    "Early access to advanced Claude features": "抢先体验 Claude 的高级功能",
    "Emails from Claude Code on the web": "来自 Claude Code 网页版的邮件",
    "Enabled background animation": "已启用背景动画",
    "Engineering": "工程",
    "Everything in Pro, plus:": "包含 Pro 的全部，外加：",
    "Example project": "示例项目",
    "Exit incognito": "退出无痕模式",
    "Expand navigation": "展开导航",
    "Export data": "导出数据",
    "Extended": "深度",
    "Extra usage": "额外用量",
    "Fastest for quick answers": "最快，适合快速回答",
    "Finance": "金融",
    "Friends can try both Cowork and Claude Code.": "朋友可以同时试用 Cowork 和 Claude Code。",
    "From $100": "起价 $100",
    "From Drive": "从 Drive",
    "Generate memory from chat history": "从聊天历史生成记忆",
    "Get a push notification on your phone when Claude messages you in Dispatch.": "当 Claude 在 Dispatch 中给你发消息时，在手机上推送通知。",
    "Get an email when Claude Code on the web has finished building or needs your response.": "当 Claude Code 网页版构建完成或需要你的回复时发送邮件。",
    "Get help": "获取帮助",
    "Get the most out of Cowork, plus 5x or 20x more usage than Pro": "充分利用 Cowork，外加 5 倍或 20 倍于 Pro 的用量",
    "Gift Claude": "赠送 Claude",
    "Give Claude, get more Claude": "赠送 Claude，获得更多 Claude",
    "Go to Customize": "前往「自定义」",
    "Good evening, Sol": "晚上好，Sol",
    "Greeting": "问候",
    "Guest pass": "访客通行证",
    "Help improve Claude": "帮助改进 Claude",
    "Hide": "隐藏",
    "Higher output limits for all tasks": "为所有任务提供更高的输出限制",
    "How to use Claude": "如何使用 Claude",
    "How we protect your data": "我们如何保护你的数据",
    "How we use your data": "我们如何使用你的数据",
    "Human resources": "人力资源",
    "Import memory from other AI providers": "从其他 AI 提供商导入记忆",
    "Includes Cowork, plus:": "包含 Cowork，外加：",
    "Incognito chat": "无痕对话",
    "Incognito chats aren’t saved, added to memory, or used to train models.": "无痕对话不会被保存、加入记忆或用于训练模型。",
    "Individual": "个人",
    "Individual plans": "个人套餐",
    "Inline visualizations": "内联可视化",
    "Install instructions here": "查看安装说明",
    "Interactive": "交互式",
    "Invoices": "发票",
    "Last message": "最后一条消息",
    "Last updated: just now": "最后更新：刚刚",
    "Learn": "学习",
    "Learn how your information is protected when using Anthropic products, and visit our": "了解使用 Anthropic 产品时你的信息如何受到保护，并访问我们的",
    "Learn more about usage limits": "了解更多用量限制",
    "Legal": "法律",
    "Let Claude read and write to the tools you already use.": "让 Claude 读写你正在使用的工具。",
    "Life stuff": "生活相关",
    "Light color mode": "浅色模式",
    "Light mode preview": "浅色模式预览",
    "Load tools when needed": "需要时加载工具",
    "Location": "位置",
    "Location metadata": "位置元数据",
    "Log out of all devices": "登出所有设备",
    "Manage": "管理",
    "Manage your authorization tokens": "管理你的授权令牌",
    "Marketing": "市场",
    "Marketing analytics": "市场分析",
    "Max plan": "Max 套餐",
    "Memory": "记忆",
    "Memory from your chats": "来自你聊天的记忆",
    "Memory preferences": "记忆偏好",
    "Monthly": "每月",
    "More information": "更多信息",
    "More options": "更多选项",
    "More usage than Free*": "比 Free 更多的用量*",
    "Most efficient for everyday tasks": "日常任务最高效",
    "Needs approval": "需要批准",
    "New artifact": "新建制品",
    "No commitment · Cancel anytime": "无需承诺 · 随时取消",
    "Not connected": "未连接",
    "Notifications": "通知",
    "Operations": "运营",
    "Organization ID": "组织 ID",
    "Other": "其他",
    "Other tools": "其他工具",
    "Package managers only": "仅包管理器",
    "Past hour": "过去一小时",
    "Payment": "支付",
    "Personal skills": "个人技能",
    "Plan usage limits": "套餐用量限制",
    "Preview": "预览",
    "Prices and plans are subject to change at Anthropic's discretion.": "价格和套餐 Anthropic 有权随时调整。",
    "Prices shown don’t include applicable tax.": "显示的价格不含税费。",
    "Priority access at high traffic times": "高峰时段优先访问",
    "Privacy Center": "隐私中心",
    "Privacy Policy": "隐私政策",
    "Privacy settings": "隐私设置",
    "Product management": "产品管理",
    "Prompt categories": "提示词分类",
    "Published": "已发布",
    "Pull requests": "拉取请求",
    "Refresh usage limits": "刷新用量限制",
    "Research": "研究",
    "Reset memory": "重置记忆",
    "Response completions": "回复补全",
    "Run more Cowork tasks at once": "同时运行更多 Cowork 任务",
    "Sales": "销售",
    "Sans": "无衬线",
    "Sans chat font": "无衬线聊天字体",
    "Search and reference chats": "搜索并引用对话",
    "Search connectors": "搜索连接器",
    "Search mode": "搜索模式",
    "Search results": "搜索结果",
    "Search skills": "搜索技能",
    "Select": "选择",
    "Select all": "全选",
    "Select your work function": "选择你的工作领域",
    "Send a friend a free week of Claude Code. If they love it and subscribe, you'll get $20 of extra usage to keep building.": "送朋友一周免费 Claude Code。如果他们喜欢并订阅，你将获得 $20 的额外用量。",
    "Session actions": "会话操作",
    "Shared chats": "共享的对话",
    "Sharing settings": "共享设置",
    "Sidebar": "侧边栏",
    "Skills": "技能",
    "Skills have moved to Customize. Head to the new Customize page to manage your skills and connectors.": "技能已迁移到「自定义」。前往新的「自定义」页面管理你的技能和连接器。",
    "Skills, connectors, and plugins shape how Claude works with you.": "技能、连接器和插件决定了 Claude 与你协作的方式。",
    "Slash command + auto": "斜杠命令 + 自动",
    "Sonnet only": "仅 Sonnet",
    "Sort by": "排序方式",
    "Sort projects": "排序项目",
    "Start import": "开始导入",
    "System chat font": "系统聊天字体",
    "Take a screenshot": "截图",
    "Teach Claude your processes, team norms, and expertise.": "把你的流程、团队规范和专业知识教给 Claude。",
    "Team and Enterprise": "团队版与企业版",
    "Team and Enterprise plans": "团队版和企业版套餐",
    "Terms apply": "受条款约束",
    "To delete your account, please cancel your Claude Pro subscription first.": "要删除账户，请先取消你的 Claude Pro 订阅。",
    "Toggle file list": "切换文件列表",
    "Tool access": "工具访问",
    "Tool access mode": "工具访问模式",
    "Tool permissions": "工具权限",
    "Tools already loaded": "工具已加载",
    "Tools": "工具",
    "Trigger": "触发器",
    "Try Cowork with a free week of Pro": "免费试用一周 Pro 体验 Cowork",
    "Try Cowork, and access the best models, unlimited projects, connectors, and more.": "试用 Cowork，访问最强模型、无限项目、连接器等。",
    "Turn on extra usage to keep using Claude if you hit a limit.": "开启额外用量，以便达到限制后继续使用 Claude。",
    "Unlimited projects to organize chats": "无限项目用于组织对话",
    "Updated": "已更新",
    "Usage limits apply.": "受用量限制约束。",
    "Use initials": "使用姓名首字母",
    "Use style": "使用样式",
    "View all plans": "查看所有套餐",
    "View and edit memory": "查看并编辑记忆",
    "View more": "查看更多",
    "View package manager domains": "查看包管理器域名",
    "Visuals": "视觉",
    "Voice": "语音",
    "Voice settings": "语音设置",
    "Web": "网页",
    "Weekly limits": "每周限制",
    "Write": "写作",
    "Yearly": "每年",
    "You haven't used Sonnet yet": "你还没有使用过 Sonnet",
    "Your artifacts": "你的制品",
    "Your chats with Claude": "你与 Claude 的对话",
    "Your preferences will apply to all conversations, within": "你的偏好将应用于所有对话，限于",
    "Your subscription will auto renew on May 1, 2026.": "你的订阅将于 2026 年 5 月 1 日自动续期。",
    "You’re incognito": "你处于无痕模式",
    "about how your data is used.": "关于你的数据如何被使用。",
    "and": "和",
    "billed annually": "按年计费",
    "billed monthly": "按月计费",
    "for more details.": "了解更多详情。",
    "in extra usage, on us": "额外用量，由我们支付",
    "security risks": "安全风险",
    "should Claude consider in responses?": "Claude 在回复时应该考虑？",
    "Allow Claude to generate interactive visualizations, charts, and diagrams directly in the conversation.": "允许 Claude 在对话中直接生成交互式可视化、图表和示意图。",
    "Allow Claude to reference other apps and services for more context.": "允许 Claude 引用其他应用和服务以获得更多上下文。",
    "Allow Claude to remember relevant context from your chats. This setting controls memory for both chats and projects.": "允许 Claude 从你的聊天中记住相关上下文。该设置同时控制对话和项目的记忆。",
    "Allow Claude to search for relevant details in past chats.": "允许 Claude 在过往对话中搜索相关内容。",
    "Allow Claude to use coarse location metadata (city/region) to improve product experiences.": "允许 Claude 使用粗略位置信息（城市/地区）以改进产品体验。",
    "Allow the use of your chats and coding sessions to train and improve Anthropic AI models.": "允许使用你的对话和编码会话训练并改进 Anthropic 的 AI 模型。",
    "Anthropic believes in transparent data practices": "Anthropic 信奉透明的数据实践",
    "Chats compact less since tools aren't pre-loaded.": "由于工具未预加载，对话更少被压缩。",
    "Chats compact more often since tools are always there.": "由于工具始终在，对话更频繁被压缩。",
    "AI-powered artifacts": "AI 驱动的制品",
    "Aa": "Aa",
    "Access to Claude's best models": "访问 Claude 最强模型",
    "Additional allowed domains": "额外允许的域名",
    "20x more usage than Pro": "比 Pro 多 20 倍用量",
    "Max (20x)": "Max（20 倍）",
    "Notifications (F8)": "通知（F8）",
    "Airy": "轻盈",
    "Buttery": "丝滑",
    "Glassy": "玻璃",
    "Mellow": "柔和",
    "Rounded": "圆润",
    "CUSTOM": "自定义",
    "More options for AgentCard": "AgentCard 的更多选项",
    "More options for Asana": "Asana 的更多选项",
    "More options for Canva": "Canva 的更多选项",
    "More options for Cloudflare Developer Platform": "Cloudflare Developer Platform 的更多选项",
    "More options for DeepWiki": "DeepWiki 的更多选项",
    "More options for Gmail": "Gmail 的更多选项",
    "More options for Google Calendar": "Google Calendar 的更多选项",
    "More options for Linear": "Linear 的更多选项",
    "More options for Notion": "Notion 的更多选项",
    "More options for Zapier": "Zapier 的更多选项",
    "More options for Invideo": "Invideo 的更多选项",
    "More options for skill-creator": "skill-creator 的更多选项",
    "More options for How to use Claude": "「如何使用 Claude」的更多选项",
    "More options for Greeting": "「问候」的更多选项",
    "More options for Driving vs walking to nearby car wash": "「Driving vs walking to nearby car wash」的更多选项",
    "More options for Jakarta time zone conversion": "「Jakarta time zone conversion」的更多选项",
    "Select Driving vs walking to nearby car wash": "选择「Driving vs walking to nearby car wash」",
    "Select Greeting": "选择「问候」",
    "Select Jakarta time zone conversion": "选择「Jakarta time zone conversion」",
    "Expand folder agents": "展开 agents 文件夹",
    "Expand folder assets": "展开 assets 文件夹",
    "Expand folder eval-viewer": "展开 eval-viewer 文件夹",
    "Expand folder references": "展开 references 文件夹",
    "Expand folder scripts": "展开 scripts 文件夹",

    // Round 3 additions
    "Search documents...": "搜索文档...",
    "Search documents…": "搜索文档…",
    "Start a new project": "开始一个新项目",
    "Last edited": "上次编辑于",
    "Last edited ": "上次编辑于 ",

    // Round 4 additions
    "Buy extra usage so people in your organization can keep using Claude if they hit a limit.": "购买额外用量，以便组织中的成员在达到限制后仍能继续使用 Claude。",
    "Current balance": "当前余额",
    "Auto-reload": "自动充值",
    "Automatically buy more extra usage when your balance is low": "余额不足时自动购买更多额外用量",

    // ============================================================
    // Round 2 additions (2026-04-10)
    // ============================================================
    "What": "",
    "Prices shown don't include applicable tax.": "显示的价格不含税费。",
    "Let's build an AI app...": "让我们构建一个 AI 应用...",
    "Let's look at your latest runs and make a plan to trim some time.": "我们一起看看你最近的运动数据，制定一个缩短时间的计划。",
    "Pull Request": "拉取请求",
    "Pull request": "拉取请求",
    "Get notified when Claude has finished a response. Most useful for long-running tasks like tool calls, Research, and Claude Code on the web.": "Claude 完成回复时通知你。最适合工具调用、深度研究、Claude Code 网页版等长时间运行的任务。",
    "Use the credit on Claude.ai, Claude Code, Claude Desktop, or third-party apps. When it runs out, you can add more extra usage to keep going past your plan limits. Expires April 17.": "在 Claude.ai、Claude Code、Claude Desktop 或第三方应用中使用此额度。用完之后可以继续添加额外用量，超出套餐限制后继续使用。2026 年 4 月 17 日到期。",
    "Bring relevant context and data from another AI provider to Claude. We'll provide a prompt you can use to fetch the memory from your other account.": "把其他 AI 提供商的相关上下文和数据带到 Claude。我们会提供一段提示词，让你从另一个账号抓取记忆。",
    "Ask Claude to generate content like code snippets, text documents, or website designs, and Claude will create an Artifact that appears in a dedicated window alongside your conversation.": "让 Claude 生成代码片段、文本文档或网页设计等内容，Claude 会创建一个制品，在对话旁边的独立窗口中显示。",
    "Create apps, prototypes, and interactive documents that use Claude inside the artifact. Start by saying, “Let’s build an AI app...” to access the power of Claude API.": "创建在制品内部使用 Claude 的应用、原型和交互式文档。说一句“让我们构建一个 AI 应用...”即可调用 Claude API。",
    "Create apps, prototypes, and interactive documents that use Claude inside the artifact. Start by saying, \"Let's build an AI app...\" to access the power of Claude API.": "创建在制品内部使用 Claude 的应用、原型和交互式文档。说一句“让我们构建一个 AI 应用...”即可调用 Claude API。",
    "Claude can execute code and create and edit docs, spreadsheets, presentations, PDFs, and data reports. Required for skills.": "Claude 可以执行代码，创建并编辑文档、电子表格、演示文稿、PDF 和数据报告。技能功能需要此项。",
    "Give Claude network access to install packages and libraries in order to perform advanced data analysis, custom visualizations, and specialized file processing. Monitor chats closely as this comes with": "授予 Claude 网络访问权限以安装包和库，用于高级数据分析、自定义可视化和专业文件处理。请密切关注对话，因为这会带来",
    "When you create a pull request, Claude automatically monitors it for CI failures and review comments, then responds proactively. Claude may post comments on your behalf.": "你创建拉取请求后，Claude 会自动监控 CI 失败和评审评论并主动响应。Claude 可能代表你发表评论。",
    "Claude Code is an agentic coding tool that lives in your terminal, understands your codebase, and helps you code faster through natural language commands.": "Claude Code 是一个运行在终端里的智能编码工具，理解你的代码库，通过自然语言命令帮你更快编程。",
    "How does usage work? When you sign in to Claude Code using your subscription, your subscription usage limits are shared with Claude Code.": "用量是怎么计算的？使用订阅登录 Claude Code 后，订阅的用量限制将与 Claude Code 共享。",
    "Claude is AI and can make mistakes. Please double-check responses.": "Claude 是 AI，可能会出错。请仔细核对回复内容。",
    "Do more with Claude, everywhere you work": "在你工作的每个地方用 Claude 做更多事",
    "Analyze data and build presentations with Claude alongside you.": "让 Claude 在你身边分析数据、制作演示文稿。",
    "Chat, cowork, and code in one app. Claude works with your files, apps, and browser tabs.": "在一个应用里聊天、协作、编码。Claude 可以读取你的文件、应用和浏览器标签页。",
    "Build, debug, and ship from your terminal or IDE.": "在终端或 IDE 中构建、调试、发布。",
    "Chat hands-free, connect Claude to your favorite apps, and kick off tasks on the go.": "免手动聊天，将 Claude 连接到你常用的应用，随时随地启动任务。",
    "Claude navigates, clicks buttons, and fills forms in your browser. Works in Cowork.": "Claude 在浏览器中导航、点击按钮、填写表单。可在 Cowork 中使用。",
    "Microsoft Office": "Microsoft Office",
    "Excel": "Excel",
    "PowerPoint": "PowerPoint",
    "Desktop": "桌面",
    "Mobile": "移动端",
    "Terminal": "终端",
    "Desktop app": "桌面应用",
    "VS Code": "VS Code",
    "JetBrains": "JetBrains",
    "Slack": "Slack",
    "iOS": "iOS",
    "Android": "Android",
    "Chrome": "Chrome",
    "New": "新",
    "Searching...": "搜索中…",
    "Searching…": "搜索中…",
    "Contemplating…": "思考中…",
    "Returns": "退货",
    "Start a return": "开始退货",
    "Select reason": "选择原因",
    "Confirmation": "确认",
    "Read health data": "读取健康数据",
    "Insert": "插入",
    "Draw": "绘图",
    "Page Layout": "页面布局",
    "Formulas": "公式",
    "Data": "数据",
    "Review": "审阅",
    "View": "视图",
    "Automate": "自动化",
    "Portfolio Monitoring": "投资组合监控",
    "Portoflio Monitoring": "投资组合监控",
    "My downloads folder is a mess! Can you clean it up?": "我的下载文件夹乱成一团了！你能帮我整理一下吗？",
    "Turn these receipts into an expense report": "把这些收据整理成一份报销单",
    "Create a shopping list, go on Chrome, and make an order": "创建购物清单，打开 Chrome，下一笔订单",
    "Fix the auth bug in signup flow": "修复注册流程的认证 bug",
    "Which names are the top movers in my portfolio and why?": "我的投资组合中涨跌最大的是哪些？为什么？",
    "5-150 users": "5–150 个用户",
    "20+ users": "20 个以上用户",
    "Predictable usage per seat": "按席位计费，用量可预测",
    "Flexible pooled usage": "灵活的池化用量",
    "Standard seat": "标准席位",
    "Premium seat": "高级席位",
    "All Claude features, plus more usage than Pro*": "Claude 全部功能，外加比 Pro 更多的用量*",
    "5x more usage than standard seats*": "比标准席位多 5 倍的用量*",
    "USD 20 /mo": "USD 20 /月",
    "USD 25 /mo when billed monthly": "按月计费时 USD 25 /月",
    "USD 100 /mo": "USD 100 /月",
    "USD 125 /mo when billed monthly": "按月计费时 USD 125 /月",
    "USD 20/seat. Usage cost scales with model and task.": "USD 20 /席位。用量费用随模型和任务而变。",
    "Seat price + usage at API rates": "席位费 + 按 API 费率计算的用量",
    "200K context window": "200K 上下文窗口",
    "500K context window": "500K 上下文窗口",
    "Extra usage available at API rates": "可按 API 费率购买额外用量",
    "Central billing and administration": "集中计费与管理",
    "Single sign-on (SSO) and domain capture": "单点登录（SSO）与域名认领",
    "Admin controls for remote and local connectors": "对远程和本地连接器的管理员控制",
    "Enterprise deployment for the Claude desktop app": "Claude 桌面应用的企业级部署",
    "Enterprise search across your organization": "面向你组织的企业搜索",
    "Connect Microsoft 365, Slack, and more": "连接 Microsoft 365、Slack 等",
    "No model training on your content by default": "默认不使用你的内容训练模型",
    "Work email address required.": "需使用工作邮箱。",
    "All Team features, plus:": "包含团队版的全部功能，外加:",
    "Pay-as-you-go pricing with pooled usage across your org": "按需付费，组织内共享用量",
    "Set user and org spend limits": "设置用户和组织的花费上限",
    "Role-based access with fine grained permissioning": "基于角色的访问控制，权限细粒度",
    "System for Cross-domain Identity Management (SCIM)": "跨域身份管理系统（SCIM）",
    "Audit logs": "审计日志",
    "Compliance API for observability and monitoring": "用于可观测性与监控的合规 API",
    "Network-level access control": "网络级访问控制",
    "Custom data retention controls": "自定义数据保留策略",
    "IP allowlisting": "IP 白名单",
    "Google Docs cataloging": "Google Docs 编目",
    "A work email address is required to create an Enterprise account. Contact sales for more information.": "创建企业版账户需要使用工作邮箱。如需更多信息请联系销售。",
    "Search chats and projects": "搜索对话和项目",
  };

  // ============================================================
  // TRANSLATOR
  // ============================================================

  const SKIP_SELECTORS = [
    '[data-testid="user-message"]',
    '.font-claude-response',
    '.font-user-message',
    '[contenteditable="true"]',
    'textarea',
    'input',
    'code',
    'pre',
    'kbd',
    'samp',
  ];

  const TRANSLATED_ATTR_PREFIX = 'data-cf-i18n-';
  const ATTR_NAMES = ['aria-label', 'placeholder', 'title', 'alt'];

  // Cached "is in skip zone?" lookup so we don't walk the DOM each time.
  // Cleared whenever we re-walk the whole tree.
  let skipCache = new WeakMap();

  function isInSkipZone(node) {
    let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    while (el && el.nodeType === Node.ELEMENT_NODE) {
      if (skipCache.has(el)) return skipCache.get(el);
      for (const sel of SKIP_SELECTORS) {
        let match = false;
        try { match = el.matches(sel); } catch (_) { /* invalid sel for this engine */ }
        if (match) {
          skipCache.set(el, true);
          return true;
        }
      }
      el = el.parentElement;
    }
    return false;
  }

  function translateString(text) {
    if (!text) return null;
    const trimmed = text.trim();
    if (!trimmed) return null;
    const zh = DICT[trimmed];
    // Note: empty string ("") is a valid translation — used to make a
    // text fragment vanish so neighbouring already-translated fragments
    // form a coherent Chinese sentence (e.g. "What" before a translated
    // link). So we can't use !zh here.
    if (zh === undefined) return null;
    if (zh === trimmed) return null;
    // Preserve any leading / trailing whitespace
    const lead = text.slice(0, text.indexOf(trimmed));
    const tail = text.slice(text.indexOf(trimmed) + trimmed.length);
    return lead + zh + tail;
  }

  // For collecting untranslated UI string candidates so the user can
  // grow the dictionary.
  let logUntranslated = false;
  const UNTRANSLATED_REPORTED = new Set();

  function maybeLogUntranslated(text) {
    if (!logUntranslated) return;
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    if (trimmed.length > 60) return;          // probably content, not UI
    if (/[\u4e00-\u9fff]/.test(trimmed)) return; // already CJK
    if (/^[\d\s\.\-:/]+$/.test(trimmed)) return; // pure numbers / dates
    if (UNTRANSLATED_REPORTED.has(trimmed)) return;
    UNTRANSLATED_REPORTED.add(trimmed);
    console.log(TAG, 'untranslated:', JSON.stringify(trimmed));
  }

  function translateTextNode(node) {
    if (node.__cfTranslated) return;
    if (isInSkipZone(node)) return;
    const orig = node.textContent;
    const translated = translateString(orig);
    if (translated !== null) {
      node.__cfOriginal = orig;
      node.textContent = translated;
      node.__cfTranslated = true;
    } else {
      maybeLogUntranslated(orig);
    }
  }

  function translateElementAttrs(el) {
    if (isInSkipZone(el)) return;
    for (const attr of ATTR_NAMES) {
      if (!el.hasAttribute(attr)) continue;
      const orig = el.getAttribute(attr);
      const stamp = el.getAttribute(TRANSLATED_ATTR_PREFIX + attr);
      if (stamp === orig) continue; // already translated, no source change
      const translated = translateString(orig);
      if (translated !== null && translated !== orig) {
        el.setAttribute(attr, translated);
        el.setAttribute(TRANSLATED_ATTR_PREFIX + attr, translated);
      } else {
        maybeLogUntranslated(orig);
      }
    }
  }

  function walkAndTranslate(root) {
    if (!root || root.nodeType === undefined) return;

    // Text nodes
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    if (isInSkipZone(root)) return;

    // Translate this element's own attributes
    translateElementAttrs(root);

    // Walk text nodes
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (isInSkipZone(n)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) translateTextNode(node);

    // Walk descendant elements with translatable attributes
    for (const attr of ATTR_NAMES) {
      let nodes;
      try { nodes = root.querySelectorAll('[' + attr + ']'); } catch (_) { continue; }
      for (const el of nodes) translateElementAttrs(el);
    }
  }

  // ============================================================
  // OBSERVER LIFECYCLE
  // ============================================================

  let observer = null;
  let started = false;

  function onMutations(mutations) {
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const added of m.addedNodes) walkAndTranslate(added);
      } else if (m.type === 'characterData') {
        const node = m.target;
        // React replaced the text content — re-translate.
        if (node.__cfTranslated && node.textContent === node.__cfOriginal) {
          // we already wrote it but the comparison may have shifted; ignore
          continue;
        }
        // Reset our flag and try again
        node.__cfTranslated = false;
        translateTextNode(node);
      } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
        translateElementAttrs(m.target);
      }
    }
  }

  function start(opts) {
    if (started) return;
    started = true;
    logUntranslated = !!(opts && opts.logUntranslated);
    skipCache = new WeakMap();
    walkAndTranslate(document.body || document.documentElement);
    observer = new MutationObserver(onMutations);
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTR_NAMES
    });
    console.log(TAG, 'translator started');
  }

  function stop() {
    if (!started) return;
    started = false;
    if (observer) { observer.disconnect(); observer = null; }
    // Restore translated text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.__cfTranslated && node.__cfOriginal !== undefined) {
        node.textContent = node.__cfOriginal;
        delete node.__cfOriginal;
        node.__cfTranslated = false;
      }
    }
    // Restore attributes (we stamped the translated value; if attribute
    // still equals stamp, revert by removing — but we don't have the
    // original. Best we can do is leave them; toggling the setting and
    // refreshing the page is the clean revert path.)
    skipCache = new WeakMap();
    console.log(TAG, 'translator stopped (page refresh recommended for full revert)');
  }

  window.ClaudeFixerTranslator = { start, stop, DICT };
})();

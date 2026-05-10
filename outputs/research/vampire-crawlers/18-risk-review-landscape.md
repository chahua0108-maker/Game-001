# 轻度擦边但不主动 Adult-Only 的平台审核与发行风险

生成时间：2026-05-10 21:45 HKT  
范围：原创 Vampire Crawlers-like Web 原型与策划研究  
目标尺度：成年女性角色、危险亲密感、视觉/声音/文案暗示；不以色情游戏或 Adult Only 为目标。

题材判断前提：以 `22-vampire-crawlers-core-experience-brief.md` 为准。本项目不是诊疗/经营/视觉小说，而是**快速清怪、卡牌构筑、走廊压迫、build 爆发**；轻度擦边必须绑定战斗，不能替代战斗。

## 结论摘要

当前最稳策略是：**商店首屏、capsule、截图、社区物品保持 PG-13；游戏内允许 S0 成熟审美 + 少量 S1 暗示；所有 mature 内容如实披露；不要让 Adult Only Sexual Content 成为定位或标签主轴。**

Steam 不是单纯“允许或禁止成人内容”的二元平台。更实际的风险链条是：

1. 内容问卷会影响地区评级、成熟内容过滤和 Valve 预发布审核。
2. Adult Only Sexual Content 会提高审核时长，并触发更强的可见性、地区、支付、活动资格风险。
3. capsule 和 community items 比游戏内内容更保守：capsule 必须 PG-13，交易卡等社区物品因不走年龄门，要求全球全年龄。
4. 2025 年以后，支付处理商/卡组织标准成为成人内容发行的外部变量；Steam、itch.io 都出现了因支付压力导致的下架、deindex 或额外审核。
5. 对本项目来说，最危险的不是“性感”，而是让题材、tag、商店素材、DLC/更新路径把玩家和审核方共同引向“这是成人内容供给”的期待。
6. 若最新方向从“夜班诊疗所/体温档案”转为“成年女性猎人/魔女/修女快速斩杀怪物”，**成人内容误读风险反而可能降低**：动作清场、武器、怪物、关卡压力会把玩家预期拉回 action roguelite；但需要额外控制 gore、处决镜头、宗教服饰 fetish 化和战损露出。
7. 最稳方向不是 adult、诊疗或关系事件，而是**战斗优先、擦边调味**：成年女性角色直接参与猎杀、发卡、爆发、处决怪物或作为高危 Boss；擦边只通过战斗语音、卡牌代价、短事件和角色剪影增强记忆点。

## 官方规则梳理

### Steam 内容问卷与成人内容披露

Steamworks 的 Content Survey 分为 General Content、Mature Content、Generative AI Content。Mature Content 部分要求披露玩家可能遇到的成熟内容，并说明这些信息会决定游戏相对用户偏好的展示方式。Steam 明确要求披露上传到 build 中的成人内容，即使它不可访问或不在产品中呈现。

关键含义：

- 不能把较重尺度内容“藏在 build 里但不开入口”来规避披露。
- 若后续内容变化影响问卷结果，已批准后不能自行重填，需要联系 Steam Support，并说明变化和测试访问方式。
- 问卷不是豁免条款；产品仍要符合 Steam 内容规则。
- Live-generated AI 的 Adult Only Sexual Content 当前不被 Steam 接受，理由是法律与客户风险过高。

来源：

- Steamworks Content Survey: https://partner.steamgames.com/doc/gettingstarted/contentsurvey

### Steam 内容规则与支付处理商条款

Steamworks Onboarding 页列出不应发布的内容，包括：

- 真实人物裸体或性露骨图片。
- 未正确标记和 age-gate 的成人内容。
- 违反可用地区法律的内容。
- 利用儿童的内容。
- 可能违反 Steam 支付处理商、卡网络、银行或互联网服务提供商规则和标准的内容，尤其是某些 Adult Only 内容。

关键含义：

- “轻度擦边”必须避免真实人物露骨素材、未成年/幼态误读、违法地区分发和未披露成熟内容。
- 2025 年加入的支付处理商条款使风险不再只由 Valve 内部尺度决定。
- 该条款措辞宽泛，实际边界可能通过个案审查体现。

来源：

- Steamworks Onboarding / Rules and Guidelines: https://partner.steamgames.com/doc/gettingstarted/onboarding

### 审核、更新、Early Access、DLC

Steam 官方 Review Process 说明，店页和 build 发布前都需要 Valve 审核；店页通常 3-5 个工作日，建议至少提前 7 个工作日提交。对于标记 Adult Only Sexual Content 的标题，店页和 build 都必须完成并一起提交，且审核可能比常规 3-5 个工作日更久。

Steam 官方文档仍写着“Review once; Update any time”，但近年媒体/开发者案例显示，成人内容新增更新可能被要求走更可审查的 DLC 路径。这个“成人内容后续更新必须 DLC 化”的说法目前应视作开发者案例/媒体报道，不应当成公开文档中的普遍明文规则。

Early Access 官方规则要求 playable game、透明预期、不能只靠众筹未来内容。2025 年媒体报道则显示，带明确成人内容的项目在申请 Steam Early Access 时出现被拒案例。该点同样是案例风险，不是当前公开文档里的明确普适条款。

来源：

- Steamworks Review Process: https://partner.steamgames.com/doc/store/review_process
- Steamworks Early Access: https://partner.steamgames.com/doc/store/earlyaccess
- Steamworks DLC: https://partner.steamgames.com/doc/store/application/dlc
- GameSpot, adult games and Early Access case: https://www.gamespot.com/articles/steam-is-no-longer-allowing-adult-games-in-early-access/1100-6534685/
- Automaton, post-launch NSFW update case: https://automaton-media.com/en/news/games-on-steam-can-no-longer-be-updated-with-nsfw-content-post-launch-but-valve-isnt-the-problem-developer-says/

### Capsule / 图形素材 / 商店素材

Steam capsule 是商店中代表游戏的横幅图。官方 Graphical Asset Rules 要求：

- 基础 capsule 只放游戏 artwork、游戏名和官方副标题。
- 所有 capsule 必须有可读 logo/name 和正确尺寸。
- 所有 store/library capsule artwork 必须 PG-13 appropriate。
- 不符合规则的游戏可能被限制商店可见性，并失去官方 Steam sales/events 的 featuring 资格。

关键含义：

- 商店首屏不能靠露骨擦边图吸点击。
- “成年女医生 + 异常走廊 + 红色病例夹 + 卡牌 UI”是可行方向；“胸臀中心裁切、走光、内衣焦点、成人暗示姿势”会破坏 capsule 风险边界。
- 促销文案不能写进基础 capsule；更新/季节活动文案只能通过 Artwork Overrides，且有时间限制和本地化要求。

来源：

- Steamworks Graphical Asset Rules: https://partner.steamgames.com/doc/store/assets/rules
- Steamworks Store Graphical Assets: https://partner.steamgames.com/doc/store/assets/standard

### Community Items / Trading Cards

Steam Trading Cards 等社区资产不走年龄门，因此官方要求“globally all-ages appropriate”。不允许：

- 部分或全裸。
- 性暗示情境。
- 年轻化角色的挑逗服装或情境。
- 走光/上衣下视角。
- 以性暗示物件为中心的图像。

关键含义：

- 如果做轻度擦边角色，社区物品必须另做全年龄版本。
- 不能把商店可接受的“成熟危险感”自动迁移到卡牌、徽章、表情、背景。

来源：

- Steamworks Community Items: https://partner.steamgames.com/doc/marketing/tradingcards

### Tags / Visibility

Steam 标签由开发者、玩家和 Steam moderator 都可施加。开发者可用 Tag Wizard 设置权重；前 20 个标签影响可见标签、浏览页、推荐、相似游戏，前 5 个尤其应清楚描述游戏。

关键含义：

- 标签是可见性系统，不是单纯营销口号。
- 本项目应把 `Roguelite`、`Deckbuilder`、`Action Roguelike`、`Horror`、`Card Battler`、`Dark Fantasy` 放在前排。
- 不建议主动把 `Sexual Content`、`NSFW`、`Hentai` 前置，否则会把推荐池和玩家期待推向成人内容供给。
- 如果玩家自然加成人标签，要判断是否准确；不准确可移除，准确则不要隐瞒内容。

来源：

- Steamworks Tags: https://partner.steamgames.com/doc/store/tags

### AI 内容

Steam 内容问卷要求披露 AI 内容：

- Pre-generated AI：开发阶段用 AI 生成的 art/code/sound 等，需要说明；Valve 会像审查非 AI 内容一样审查输出，重点包括非法或侵权风险、与营销材料一致。
- Live-generated AI：运行时生成内容，还需说明 guardrails，确保不生成非法内容。
- Live-generated AI Adult Only Sexual Content 当前不被 Steam 接受。

关键含义：

- 如果原型或商店素材使用 AI 生成角色图、声音、文案，需要保留来源与授权记录，并准备披露。
- 不要让 AI 运行时生成成人暗示文本、角色图或语音；即使目标不是 Adult Only，也会提高审核解释成本。

来源：

- Steamworks Content Survey / Generative AI: https://partner.steamgames.com/doc/gettingstarted/contentsurvey

## 近年平台与支付风险案例

### Steam：支付处理商规则进入发布边界

2025 年 7 月，媒体报道 Steam 发布规则加入支付处理商、卡网络、银行和互联网服务提供商相关条款，并有成人游戏被下架。GameSpot 引述 Valve 对 GamingOnLinux 的回应：Valve 表示收到通知称某些游戏可能违反支付处理商及相关网络/银行标准，因此从 Steam 商店退休这些游戏，否则失去支付方式会影响 Steam 上其他游戏和内容购买。

这不是“所有擦边都会被下架”，但说明 Adult Only 内容一旦触碰支付处理商敏感区，平台会优先保护整体支付能力。

来源：

- GameSpot: https://www.gamespot.com/articles/steams-updated-guidelines-allow-banks-to-enforce-standards-on-adult-only-content/1100-6533253/
- Steamworks Onboarding / rule 15: https://partner.steamgames.com/doc/gettingstarted/onboarding

### itch.io：成人 NSFW 内容 deindex 与支付处理商审查

itch.io 官方 2025 年 7 月公告称，已将所有 adult NSFW 内容从 browse/search 中 deindex，原因是平台受到支付处理商对部分内容性质的审查。itch.io 表示会进行内容审计，之后 NSFW 页面需要创作者确认其内容符合对应支付处理商政策；部分页面会永久移除。后续 FAQ 说明，itch.io 是开放 UGC 平台，内容量大且标签不够可靠，因此采取更广泛审查；同时平台体量小，对 PayPal/Stripe 的议价能力有限，并暂停 Stripe 支付 18+ 内容。

这对本项目的含义：

- itch.io 对“搜索可见性”的影响可能比 Steam 更突然。
- 即使页面仍可访问，deindex 会显著损害发现和收入。
- 如果 Web 原型先上 itch.io，最好保持非 NSFW 页面定位，成人内容只作为可关闭暗示，不要把页面标为 adult NSFW。

来源：

- itch.io official update: https://itch.io/updates/update-on-nsfw-content

### 支付处理商：数字成人内容是高风险项

PayPal 官方说明不允许账户买卖“sexually oriented digital goods or content delivered through a digital medium”，并在可接受使用政策中将 Mature Audience Content、Online Dating、Live Streaming/Broadcasting 等列为需要预批准或敏感类别。

Mastercard 2021 年公告强调成人内容商户需要更强内容控制、年龄/身份验证、发布前内容审核、投诉处理和移除机制。虽然其目标是打击非法成人内容，但对平台方的实际影响是：平台需要证明可控，否则支付风险会外溢到整个商店。

这对本项目的含义：

- 一旦产品被归类为数字成人内容，风险从“Steam 审核”扩展到支付、结算、地区和外部分销。
- “成人内容作为主卖点”会让支付链路比游戏内容本身更难控制。

来源：

- PayPal sexually oriented goods/services policy: https://www.paypal.com/us/cshelp/article/what-is-paypal%E2%80%99s-policy-on-transactions-that-involve-sexually-oriented-goods-and-services-help384
- PayPal Acceptable Use Policy: https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
- Mastercard adult content controls: https://www.mastercard.com/news/perspectives/2021/protecting-our-network-protecting-you-preventing-illegal-adult-content-on-our-network

### 地区与年龄验证：德国、英国等

成人内容在不同地区可能出现额外限制。早期案例中，成人内容游戏在多个国家/地区不可销售。2025 年英国 Online Safety Act 相关报道显示，Steam 对英国用户访问成熟内容页面引入信用卡年龄验证流程；GameSpot 报道中也提到 sexual content 为主的游戏处理差异更明显。德国长期存在成人内容访问/年龄验证风险。

这对本项目的含义：

- Adult Only 会影响全球可达市场，不只是“店页多一个标签”。
- 如果目标是 Web 原型与未来 Steam 页面验证，避免 Adult Only 能保留更多地区、活动和自然流量。

来源：

- GameSpot UK age verification: https://www.gamespot.com/articles/steam-now-requires-a-credit-card-to-verify-your-age-when-viewing-mature-games-in-the-uk/1100-6534408/
- PCGamesN adult game territory restrictions: https://www.pcgamesn.com/steam-uncensored-adult-games

## 四类题材发行风险评估

评分口径：低 = 可通过素材/命名控制；中 = 需要严格边界和披露；高 = 容易被标签、素材、玩家期待或支付风险推入 Adult Only。

新增判断：需要把两类表达分开看。

- **诊疗 / 收容 / 关系事件**：成人误读风险来自“身体检查、同意书、体温、污染、亲密关系、可跳过事件”。优点是商店可 PG-13，缺点是如果玩法展示不够强，容易被误认为模拟经营、视觉小说或成人事件驱动。
- **猎杀 / 处决 / 动作清场**：成人误读风险较低，因为核心语义是战斗、武器、怪物、移动和 build 爽感；但会增加暴力、血腥、处决、宗教符号和 gore 方面的 mature content 风险。

| 题材 | 成人误读风险 | 动作/暴力审核风险 | 主要触发点 | 推荐策略 |
|---|---:|---:|---|---|
| 异常收容 / 夜班诊疗所 | 中 | 低-中 | 诊疗语汇被写成性化检查；身体样本、体温、污染被过度肉体化；真实医学/强制治疗误读；模拟经营/关系事件预期盖过斩杀爽感 | 若保留，只作为 hub、关卡外档案和战后复盘；首屏必须展示怪物潮、武器、卡牌连锁和快速清场，不让“诊疗”成为玩法主语 |
| 成年女性猎人 / 猎巫修道院 | 低-中 | 中 | 修女/猎巫服饰 fetish 化；宗教意象 + 血液 + 处决；斩杀镜头过度强调身体破坏；吸血鬼/修女成人标签偏移 | 更适合 Vampire Crawlers-like 主轴；用“猎杀、净化、圣印、武器、怪潮”压住成人误读；轻度擦边只做角色气质和短文案调味 |
| 成年魔女 / 女巫调查局 | 低 | 低-中 | 魔女服装幼态化或过度暴露；契约/献祭文案成人化；AI 图生成幼态/露出；法术处决若过 gore | 最稳的动作化选择之一；定位为魔女猎手/调查员快速清场，用咒文、符文、卡牌 combo 表达性感张力，不卖成人事件 |
| 赛博魅魔 / 地狱公司 | 高 | 低-中 | “魅魔”本身指向成人期待；欲望/合同/灵魂税易被 tag 成 NSFW；玩家可能预期成人内容，不足则差评，过量则 Adult Only | 不做主轴标题；若用，改为恶魔猎人/地狱债务清算，魅魔只作为 boss/商人/高风险契约来源 |

### 最新题材判断：战斗优先、擦边调味，比 adult/诊疗/关系事件更稳

根据 `22-vampire-crawlers-core-experience-brief.md`，本项目核心不是“诊疗/经营/视觉小说”，而是快速清怪、卡牌构筑、走廊压迫和 build 爆发。因此，“成年女性猎人 / 魔女 / 修女快速斩杀怪物，轻度擦边只做战斗调味”在发行风险上优于 adult 主轴、诊疗主轴和关系事件主轴。

原因：

1. **核心动词更安全**：猎杀、闪避、处决怪物、清场、抽卡连锁的玩家预期是动作游戏，不是成人互动。
2. **商店素材更容易解释**：武器、怪潮、符文、血月、卡牌爆发能支撑 PG-13 capsule；性感角色只是英雄识别，不是产品承诺。
3. **标签更不容易跑偏**：`Action Roguelike / Roguelite / Deckbuilder / Hack and Slash / Dark Fantasy / Horror` 能压住成人标签；诊疗/关系事件更容易让用户关注“亲密内容”。
4. **审核解释更直接**：平台看到的是成年角色战斗怪物，而不是身体检查、样本提交、同意书、体温升高等可能被误读为成人暗示的系统。
5. **留存承诺更健康**：玩家刷的是清场效率、build 爆发、武器流派和角色熟练度；擦边只是角色记忆点，不会变成成人内容供给压力。
6. **事件不会打断节奏**：brief 要求高频击杀、奖励和 10 分钟内爆发；短促战斗台词、卡牌风险和节点奖励比长段亲密事件更符合体验，也更不容易被平台/玩家归类为成人内容。

但动作化会把风险转移到暴力和素材层：

- 处决镜头不要做成慢镜头肢解展示。
- 血液可风格化，不要现实 gore。
- 修女/猎巫服饰不要做成成人 fetish 主视觉。
- 战损可以表现压力，但不能变成露出奖励。
- 敌人死亡反馈要服务清场爽感，不要把身体破坏作为卖点。

### 对 22 号 brief 中三个修正方向的发行风险判断

| 方向 | 成人误读风险 | 平台/商店优势 | 主要风险 | 结论 |
|---|---:|---|---|---|
| 血月猎巫：修道院清算 | 低-中 | 10 秒内可展示女猎人、怪潮、武器轨迹、卡牌爆发；不需要成人事件解释吸引力 | 修女/宗教服饰 fetish 化；血液、处决、忏悔文案过重 | 强候选，但必须架空宗教、风格化血液、避免服装成为卖点 |
| 夜班猎杀：异常清除令 | 低 | 保留异常收容识别，但核心动词变成清除、猎杀、封锁、处决怪物；比诊疗所更像动作游戏 | 若回到病例、复查、体温、关系事件，会重新滑向诊疗/成人误读 | 最稳折中：可继承异常题材，又满足动作清场 |
| 魔女处刑局：禁忌合同 | 低 | 魔女、合同、咒文、处刑、卡牌 combo 天然绑定战斗；商店 PG-13 空间大 | 契约/禁忌文案成人化；魔女角色幼态或过度暴露 | 最稳成人风险方案，适合做主方向或与猎巫融合 |

发行角度排序：

1. **夜班猎杀：异常清除令**：最稳，能保留异常收容差异化，同时把诊疗/关系降级为局外包装。
2. **魔女处刑局：禁忌合同**：成人误读最低，卡牌和战斗语义最顺。
3. **血月猎巫：修道院清算**：点击强、动作强，但宗教服饰和血液表达要更严格。
4. **夜班诊疗所/体温档案**：不建议主轴，只适合作为 hub/档案/升级层。
5. **赛博魅魔/地狱公司**：成人误读最高，除非完全改成恶魔猎杀/债务清算，否则不适合作为当前主线。

### 1. 异常收容 / 夜班诊疗所

推荐等级：作为主轴下降，适合保留为 hub/档案/局外层。  
发行风险：低-中。  
适合当前目标：成人内容风险可控，但会削弱“快速斩杀怪物”的第一眼预期。

优势：

- 成人女性角色可通过医生、调查员、档案管理员、异常顾问等职业身份站住。
- 危险亲密感来自“夜班、隔离、诊疗、污染、体温、病例”，不需要明确成人内容。
- 商店素材天然能 PG-13：走廊、监控、病例夹、红色警报、卡牌 UI。
- tags 可稳定落在 `Horror / Roguelite / Deckbuilder / Card Battler`。
- 可作为战后修整、病例档案、禁忌升级、角色关系事件层，承接轻度擦边。

风险触发点：

- 把“检查/诊疗/同意书”写成成人服务暗示。
- 角色视觉只剩白袍性感剪影，缺少职业和恐怖功能。
- 声音做成露骨 ASMR 或成人语音。
- 上传隐藏成人 CG 或事件，导致内容问卷必须升级。
- 商店首屏如果只展示医生、走廊、体温档案，容易被误读为模拟经营/叙事关系游戏，而不是动作清场。

规避策略：

- 所有角色明确成年，并以职业身份和机制功能命名。
- 文案使用体征、污染、风险、同意、代价，避免性行为词汇。
- 商店截图优先展示走廊压迫、卡牌构筑、敌潮、UI。
- mature disclosure 如实填写，但不要主动进入 Adult Only。
- 不让“诊疗所”当标题主语；可改成“猎人进入异常诊疗所清剿失控病例”，把诊疗所做成战斗场景和升级设施。

### 2. 哥特血疗院 / 猎巫修道院

推荐等级：动作主轴下上升，适合作为“成年女性猎人快速斩杀怪物”的强候选。  
发行风险：中。

优势：

- 哥特、血液、猎巫、忏悔和圣印非常适合卡牌代价机制。
- 成年女猎人/血疗师/修道院管理者能提供强记忆点。
- 暗黑奇幻和恐怖标签可支撑非成人定位。
- 快速斩杀、武器、圣印爆发和怪物潮能把玩家期待拉回动作 roguelite，降低成人内容误读。

风险触发点：

- 修女服装和宗教意象容易被做成 fetish 主视觉。
- 血液 + 身体 + “忏悔/惩罚”文案若处理不慎，会提高支付和审核敏感度。
- 与吸血鬼成人内容、hentai 修女内容的推荐池距离更近。
- 处决、血疗和净化如果表现为现实肢解/gore，会从成人风险转为暴力审核风险。

规避策略：

- 标题避开“修女诱惑/吸血鬼后宫”等成人联想，优先“血疗院/猎巫档案/圣印污染”。
- 视觉重心放在蜡烛、圣印、血疗器械、怪物、卡牌，不放在服装暴露。
- 对宗教元素做架空化，不碰现实宗教亵渎式卖点。
- 成人暗示留在个别事件和危险契约，不作为宣传主轴。
- 商店首屏展示成年女猎人清场、怪物潮、武器轨迹和卡牌 combo；轻度擦边只作为角色气质，不作为截图中心。

### 3. 魔女秘仪 / 女巫调查局

推荐等级：动作主轴下最稳健，适合“成年魔女快速清场 + 卡牌咒文”的主方向。  
发行风险：低-中。

优势：

- 魔女、契约、献祭、咒文、封印天然适配 deckbuilder。
- 可性感但不低俗，商店 PG-13 空间更大。
- 可用“调查局”把角色从纯魔女幻想拉回职业与任务。
- 咒文爆发、符文弹幕、召唤物和怪物清场非常容易解释为动作玩法，成人误读低于诊疗关系事件。

风险触发点：

- 魔女服装幼态化或过度暴露。
- “献祭/契约/秘仪”写成成人邀约。
- AI 生成图容易滑向幼态动漫或暴露姿势，增加审核解释成本。

规避策略：

- 主轴放“调查、封印、异常仪式、咒文构筑”，不是魔女恋爱/后宫。
- 角色年龄感、职业感和权力关系清晰，不使用学生/学徒未成年暗示。
- capsule 用仪式空间、符文、调查员剪影、卡牌阵列。
- 如果使用 AI 图，保留 prompt、模型、授权、人工修订记录。
- 优先用 `Witch Hunter`、`Hex Hunt`、`Coven Breaker`、`Ritual Slayer` 这类动作语义，避免 `Witch Romance`、`Succubus`、`Forbidden Desire` 等成人联想。

### 4. 赛博魅魔 / 地狱公司

推荐等级：商业点击强，但当前不建议做主轴。  
发行风险：高。

优势：

- 点击和短视频传播潜力强。
- 合同、债务、灵魂税、绩效、审计都能变成卡牌机制。
- 喜剧化地狱公司可以差异化。

风险触发点：

- “魅魔”在标题、capsule 或 top tags 中几乎天然把玩家期待推向成人内容。
- 如果内容轻，会被成人向玩家认为不满足；如果内容重，会触发 Adult Only、支付、地区和活动资格风险。
- 赛博霓虹 + 成人角色视觉容易被算法和玩家标签推向 `Sexual Content / NSFW`。

规避策略：

- 不用“赛博魅魔”作为 Steam 标题主语；改为“地狱审计局 / Soul Tax / Infernal Compliance”。
- 魅魔只作为高风险 boss、商人或契约来源，不是全局角色池。
- 主视觉用公司、合同、恶魔审计、霓虹办公室、卡牌账本，不用成人诱惑构图。
- 避免直播生成成人文本、AI 角色聊天和可付费亲密互动。

## 推荐发行路线

### 原型阶段

- 页面定位：原创 horror roguelite deckbuilder / Vampire Crawlers-like。
- 内容尺度：S0 + 少量 S1；不做露点、性行为、成人 CG、露骨语音。
- 题材优先：`夜班猎杀：异常清除令`、`魔女处刑局：禁忌合同` 或 `血月猎巫：修道院清算`。共同前提是快速清怪、卡牌构筑、走廊压迫、build 爆发；夜班诊疗所只保留为 hub、档案、升级和少量短事件层。
- 商店/项目页素材：PG-13，强调玩法和世界观，不以成人内容吸点击。
- 首屏必须有怪潮、武器/咒文轨迹、卡牌 UI 和清场反馈；不能先展示诊疗、经营、关系对话或成人暗示事件。
- AI：若用 AI 预生成素材，留存生成记录；不要做 live-generated 成人暗示。

### Steam 准备阶段

- 在 build 内容冻结前做一次 mature content inventory：角色图、事件、卡牌、语音、商店图、隐藏资源都列出。
- Content Survey 如实填写；若尺度仍在暗示和成熟审美，不主动勾 Adult Only Sexual Content。
- Top tags 保持玩法主轴，不前置成人标签。
- capsule 和 community items 做单独审核清单：capsule PG-13，community items 全年龄。
- 若后续真的要加入更重尺度内容，优先做独立 DLC/分支决策评估，而不是 patch 偷加。

### itch / Web Demo 阶段

- itch 页面不标 NSFW，除非内容真实进入成人 NSFW。
- 页面图不使用成人暗示主视觉，避免被 deindex。
- 不使用 Stripe/PayPal 直连销售成人内容；若未来成人化，单独评估支付链路。

## 可以做擦边但尽量不进入 Adult Only 的操作边界清单

1. **角色边界**：所有可擦边角色必须明确成年，脸型、身高、语气、职业身份都避免未成年/幼态误读。
2. **商店边界**：capsule、首屏、截图首图、宣传 GIF 保持 PG-13；不以裸露、内衣、走光、胸臀裁切为卖点。
3. **玩法边界**：擦边元素必须绑定卡牌、污染、代价、角色关系或 build 风险；不能成为独立成人内容供给。
4. **战斗绑定边界**：轻度擦边必须在战斗中有功能位置，例如高风险卡牌、污染爆发、武器觉醒、Boss 诱导、短促战斗语音、局外解锁；不能只做 hub 亲密对话。
5. **文本边界**：动作主轴优先使用猎杀、净化、封印、处决怪物、符文、武器、契约代价等词；诊疗词如体温、脉搏、复查、样本只放局外层，避免成为成人误读主语；不用露骨性描写。
6. **声音边界**：可用心跳、低语、手套、监护仪、衣料、门锁；不用明显性行为音效或成人呻吟。
7. **素材边界**：不使用真实人物露骨图像；不上传隐藏成人素材；不用 AI 生成或 live 生成 Adult Only sexual content。
8. **标签边界**：top tags 优先玩法和题材；不主动把 `Sexual Content / NSFW / Hentai` 做前排定位。
9. **社区物品边界**：交易卡、徽章、表情、背景按全球全年龄做，不复用轻度擦边图。
10. **地区边界**：一旦进入 Adult Only，预期会有德国、英国等地区访问/年龄验证/销售影响；当前路线应尽量避免。
11. **更新边界**：发布后不要通过普通 patch 增加更重成人内容；先评估问卷、审核、DLC、支付和地区影响。
12. **AI 边界**：AI 预生成内容保留来源和授权记录；live-generated AI 不生成成人暗示或色情内容。
13. **支付边界**：不要把产品描述、页面和付款链路塑造成“数字成人内容销售”；否则 PayPal/Stripe/卡组织风险会外溢。
14. **动作边界**：快速斩杀可以做，但处决反馈应风格化、短促、服务清场效率；不要把现实肢解、痛苦特写、战损露出做成奖励。

## 参考 URL

- Steamworks Content Survey: https://partner.steamgames.com/doc/gettingstarted/contentsurvey
- Steamworks Onboarding / Rules and Guidelines: https://partner.steamgames.com/doc/gettingstarted/onboarding
- Steamworks Review Process: https://partner.steamgames.com/doc/store/review_process
- Steamworks Early Access: https://partner.steamgames.com/doc/store/earlyaccess
- Steamworks DLC: https://partner.steamgames.com/doc/store/application/dlc
- Steamworks Graphical Asset Rules: https://partner.steamgames.com/doc/store/assets/rules
- Steamworks Store Graphical Assets: https://partner.steamgames.com/doc/store/assets/standard
- Steamworks Community Items: https://partner.steamgames.com/doc/marketing/tradingcards
- Steamworks Tags: https://partner.steamgames.com/doc/store/tags
- itch.io Update on NSFW Content: https://itch.io/updates/update-on-nsfw-content
- PayPal sexually oriented goods/services policy: https://www.paypal.com/us/cshelp/article/what-is-paypal%E2%80%99s-policy-on-transactions-that-involve-sexually-oriented-goods-and-services-help384
- PayPal Acceptable Use Policy: https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
- Mastercard adult content controls: https://www.mastercard.com/news/perspectives/2021/protecting-our-network-protecting-you-preventing-illegal-adult-content-on-our-network
- GameSpot, Steam payment processor rule: https://www.gamespot.com/articles/steams-updated-guidelines-allow-banks-to-enforce-standards-on-adult-only-content/1100-6533253/
- GameSpot, adult games and Early Access case: https://www.gamespot.com/articles/steam-is-no-longer-allowing-adult-games-in-early-access/1100-6534685/
- Automaton, post-launch NSFW update case: https://automaton-media.com/en/news/games-on-steam-can-no-longer-be-updated-with-nsfw-content-post-launch-but-valve-isnt-the-problem-developer-says/
- GameSpot, UK age verification: https://www.gamespot.com/articles/steam-now-requires-a-credit-card-to-verify-your-age-when-viewing-mature-games-in-the-uk/1100-6534408/
- PCGamesN, adult game territory restrictions: https://www.pcgamesn.com/steam-uncensored-adult-games

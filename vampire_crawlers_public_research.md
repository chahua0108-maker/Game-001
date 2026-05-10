# Vampire Crawlers 公共资料采集报告

## Steam 评测接口尝试

- 目标：`appid 3265700`
- 官方公共页面：`https://store.steampowered.com/app/3265700/Vampire_Crawlers/`
- 公开社区评测页：`https://steamcommunity.com/app/3265700/reviews/`
- Steamworks 文档：`https://partner.steamgames.com/doc/store/getreviews`

### 结果

- 我尝试了 `store.steampowered.com/appreviews/3265700?json=1...` 的公开接口请求。
- 在当前环境中，该接口对 `curl` 返回空响应 / bot challenge，未能稳定取得 JSON。
- 因此没有生成全量 JSON/CSV 文件。

### 可核验的公开汇总

- English Reviews: Overwhelmingly Positive (`6,585`)
- Total reviews in all languages: `13,977` Overwhelmingly Positive
- Review Type: All `14,435`, Positive `13,947`, Negative `488`
- Purchase Type: Steam Purchasers `13,977`, Other `458`
- Language breakdown visible on store page:
  - English `6,585`
  - Simplified Chinese `3,964`
  - Russian `556`
  - Portuguese - Brazil `475`
  - Spanish - Spain `417`
  - German `297`
  - French `297`
  - Traditional Chinese `288`
  - Japanese `234`
  - Korean `230`

### 公开评测页字段样本

- `Recommended` / `Not Recommended`
- `19.9 hrs on record`, `20.0 hrs on record`, `31.7 hrs on record`
- `Posted: April 30`, `Posted: April 28`, `Posted: May 4`
- 作者名与产品数展示在社区页中

## 媒体与视频

- 详见本地研究结果与外部链接整理。


# Gem 提示詞管理系統 (前後端分離版)

本專案是「Gem 提示詞管理系統」的前後端分離部署版本。網頁前端託管在 **GitHub Pages**，資料儲存與文件上傳後端則由 **Google Apps Script (GAS) API** 處理，並將資料寫入 Google 試算表（Google Sheets）與儲存於 Google 雲端硬碟（Google Drive）。

## 目錄結構說明

```
├── index.html                  # 獨立前端網頁 (部署於 GitHub Pages)
├── README.md                   # 部署與設定指南 (本檔案)
├── .gitignore                  # Git 忽略檔案設定
├── documents/                  # 專案規格書與資料庫備份檔案
│   ├── Gem管理工具 專案規格書 V1.50.docx
│   └── Gem管理工具資料庫.xlsx
└── gas/                        # GAS 程式碼目錄
    └── code.gs                 # 改寫後的 API 後端程式碼
```

---

## 部署與設定教學

請依照以下 3 個主要步驟完成系統的全新發佈：

### 步驟 1：部署 Google Apps Script 後端

1. 開啟您的 Google 試算表，點選上方選單的 **「擴充功能」 > 「Apps Script」**。
2. 將原有的程式碼全部清除，複製並貼上本專案 `gas/code.gs` 的完整代碼。
3. 點選右上角的 **「部署」 > 「新部署」**：
   * **選取類型**：點選齒輪圖示，選取 **「網頁應用程式 (Web App)」**。
   * **說明**：例如輸入 `Gems Manager Decoupled API V1.5`。
   * **執行身分**：選取 **「我 (您的 Google 帳號)」**。
   * **誰有權限存取**：選取 **「任何人 (Anyone)」**。 (⚠️ 非常重要，這樣網頁才能發送請求)
4. 點選 **「部署」**。如果系統要求授權，請授權該專案存取您的雲端硬碟與試算表。
5. 部署成功後，**複製產生的「網頁應用程式網址」** (例如：`https://script.google.com/macros/s/XXXXXX/exec`)。

---

### 步驟 2：設定前端網頁的 API 網址

1. 在本機文字編輯器中開啟 **`index.html`**。
2. 找到程式碼第 **255 行** 左右的變數定義：
   ```javascript
   // ⚠️ 請在此處填入您的 Google Apps Script 部署 URL
   const GAS_API_URL = ""; 
   ```
3. 將您在步驟 1 複製的 **網頁應用程式網址** 貼入引號內，例如：
   ```javascript
   const GAS_API_URL = "https://script.google.com/macros/s/XXXXXX/exec"; 
   ```
4. 存檔關閉。
5. 您此時可在本機雙擊開啟 `index.html`，測試是否能成功同步雲端試算表資料。

---

### 步驟 3：發佈至 GitHub Pages

1. 在 GitHub 上建立一個新的儲存庫 (Repository)，例如命名為 `gems-manager`。
2. 開啟終端機 (Terminal)，切換至本專案根目錄，執行以下指令初始化 Git 並推送到 GitHub：
   ```bash
   # 初始化 Git
   git init
   
   # 將檔案加入追蹤
   git add .
   
   # 提交初始版本
   git commit -m "Initial commit: Gems Manager decoupled version"
   
   # 變更主要分支名稱為 main
   git branch -M main
   
   # 連結至您的 GitHub 儲存庫
   git remote add origin https://github.com/您的帳號/gems-manager.git
   
   # 推送程式碼
   git push -u origin main
   ```
3. 前往該 GitHub 專案網頁，進入 **Settings** > **Pages**：
   * **Build and deployment** 下的 **Branch** 選擇 **`main`**，資料夾選擇 **`/ (root)`**。
   * 點選 **Save**。
4. 等待 1~2 分鐘，GitHub 會在該頁面頂端顯示您的專屬發佈網址 (例如：`https://您的帳號.github.io/gems-manager/`)。現在，您可以從任何裝置登入這個網址直接使用該系統了！

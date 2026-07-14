/**
 * ====================================================================
 * Google Apps Script 提示詞管理系統後端核心程式碼 (Code.gs) - Decoupled API 版
 * ====================================================================
 */

// 🌍 全域常數設定
var SPREADSHEET_ID = '1Lq75EtfQCyfpDPYGUMIrMIuhLmeEdZtEi8THLOHUq7A'; // 💡 指定的 Google Sheets ID
var SPREADSHEET_SHEET_NAME = 'GemList';
var TARGET_FOLDER_NAME = 'Reference'; // 💡 修改上傳資料夾名稱為 Reference
var DRIVE_FOLDER_ID = '1CXPKxt5W9COf6P3CnBSY9fgwDjMMdObc'; // 💡 指定的 Google Drive 資料夾 ID
var SETTINGS_SHEET_NAME = 'Settings';

/**
 * 輔助函式：取得試算表實例 (優先使用 SPREADSHEET_ID，安全備用為 ActiveSpreadsheet)
 */
function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    try {
      return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
    } catch(e) {
      Logger.log("無法使用 SPREADSHEET_ID 開啟試算表，採用預設綁定試算表: " + e.toString());
    }
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * 網頁進入點 (GET 請求)：處理讀取資料的 API 請求
 */
function doGet(e) {
  var action = e && e.parameter && e.parameter.action;
  
  try {
    if (action === 'getGemList') {
      var list = getGemList();
      var lastDeployTime = getLastUpdatedTime();
      return makeJsonResponse({ status: 'success', gems: list, lastDeployTime: lastDeployTime });
    } 
    
    if (action === 'getCategoryOptions') {
      var options = getCategoryOptions();
      return makeJsonResponse({ status: 'success', categories: options });
    }
    
    // 如果是直接瀏覽 (無 action 參數)，回傳簡單的運作狀態說明
    return makeJsonResponse({ 
      status: 'ok', 
      message: 'Gems Manager API 後端正常運作中。請使用前端網頁進行操作。',
      lastDeployTime: getLastUpdatedTime()
    });
  } catch (err) {
    return makeJsonResponse({ status: 'error', message: 'GET 請求處理失敗: ' + err.toString() });
  }
}

/**
 * 網頁進入點 (POST 請求)：處理新增、編輯、刪除的 API 請求
 * 💡 註：為避免 CORS Preflight (OPTIONS) 限制，前端會以 Content-Type: text/plain 傳送 JSON 字串
 */
function doPost(e) {
  var result;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return makeJsonResponse({ status: 'error', message: '收到空請求內容' });
    }
    
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    var formData = payload.formData;
    
    if (action === 'saveGemData') {
      result = saveGemData(formData);
    } else if (action === 'deleteGemRecord') {
      result = deleteGemRecord(payload.rowIndex);
    } else if (action === 'deleteFileFromDrive') {
      result = deleteFileFromDrive(payload.rowIndex, payload.fileId, payload.currentFilesJson);
    } else {
      result = { status: 'error', message: '未知的 POST Action: ' + action };
    }
  } catch (error) {
    result = { status: 'error', message: '處理 POST 請求失敗: ' + error.toString() };
  }
  return makeJsonResponse(result);
}

/**
 * 輔助函式：建立標準的 JSON 回傳格式
 */
function makeJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 取得本 Apps Script 專案在雲端硬碟的最後更新時間
 */
function getLastUpdatedTime() {
  var lastUpdatedStr = "2026-07-14 09:40"; // 安全備用時間
  try {
    var scriptId = ScriptApp.getScriptId();
    var scriptFile = DriveApp.getFileById(scriptId);
    var lastUpdatedDate = scriptFile.getLastUpdated();
    
    // 格式化時間為：YYYY-MM-DD HH:mm
    lastUpdatedStr = Utilities.formatDate(lastUpdatedDate, "GMT+8", "yyyy-MM-dd HH:mm");
  } catch(e) {
    Logger.log("無法動態讀取專案儲存時間: " + e.toString());
  }
  return lastUpdatedStr;
}

/**
 * 取得所有 Gem 資料清單（依最後更新時間由新到舊排序）
 */
function getGemList() {
  var sheet = getSpreadsheet().getSheetByName(SPREADSHEET_SHEET_NAME);
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  var headers = data[0].map(function(h) { return h.toString().trim(); });
  var list = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var item = {};
    var fallbackTime = i * 1000; 
    var finalSortValue = fallbackTime;
    
    for (var j = 0; j < headers.length; j++) {
      var key = headers[j];
      var cellValue = row[j];
      if (cellValue === undefined || cellValue === null) {
        cellValue = '';
      }
      
      if (key === '最後更新時間') {
        if (cellValue instanceof Date && !isNaN(cellValue.getTime())) {
          finalSortValue = cellValue.getTime();
          item[key] = Utilities.formatDate(cellValue, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else if (cellValue.toString().trim() !== '') {
          var parseTest = new Date(cellValue.toString());
          if (!isNaN(parseTest.getTime())) {
            finalSortValue = parseTest.getTime();
            item[key] = cellValue.toString().trim();
          } else {
            item[key] = cellValue.toString().trim();
          }
        } else {
          item[key] = '';
        }
      } else {
        item[key] = cellValue.toString().trim();
      }
    }
    
    if (!item['Gem類別']) item['Gem類別'] = '未分類';
    if (!item['Gem名稱']) item['Gem名稱'] = '未命名 Gem';
    
    item['rawSortTime'] = finalSortValue; 
    item['rowIndex'] = i + 1; 
    list.push(item);
  }
  
  list.sort(function(a, b) {
    return b.rawSortTime - a.rawSortTime;
  });
  
  return list;
}

/**
 * 讀取 Settings 分頁中的自訂預設分類
 */
function getCategoryOptions() {
  try {
    var sheet = getSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
    if (!sheet) return [];
    var lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    
    var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var categories = [];
    for (var i = 0; i < values.length; i++) {
      var cat = values[i][0];
      if (cat !== undefined && cat !== null) {
        var catStr = cat.toString().trim();
        if (catStr !== '') categories.push(catStr);
      }
    }
    return categories;
  } catch(e) { return []; }
}

/**
 * 自動生成下一個 GEM 編號
 */
function generateNextId() {
  var sheet = getSpreadsheet().getSheetByName(SPREADSHEET_SHEET_NAME);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'GEM-001';
  var lastId = sheet.getRange(lastRow, 1).getValue().toString();
  var match = lastId.match(/GEM-(\d+)/);
  if (match) {
    return 'GEM-' + (parseInt(match[1], 10) + 1).toString().padStart(3, '0');
  }
  return 'GEM-001';
}

/**
 * 儲存或更新 Gem 資料
 */
function saveGemData(formData) {
  if (!formData || typeof formData !== 'object') {
    return { status: 'error', message: '儲存失敗：收到空資料' };
  }

  var sheet = getSpreadsheet().getSheetByName(SPREADSHEET_SHEET_NAME);
  var now = new Date();
  var filesList = [];
  
  if (formData.fileUrl && formData.fileUrl.trim() !== '') {
    var rawStr = formData.fileUrl.trim();
    if (rawStr.indexOf('[') === 0) {
      try { filesList = JSON.parse(rawStr); } catch(e) { filesList = []; }
    } else {
      var oldUrls = rawStr.split(',').map(function(u){ return u.trim(); }).filter(Boolean);
      oldUrls.forEach(function(url) {
        filesList.push({ name: '歷史附件', url: url, id: '' });
      });
    }
  }
  
  if (formData.filesArray && formData.filesArray.length > 0) {
    for (var i = 0; i < formData.filesArray.length; i++) {
      var fileObj = formData.filesArray[i];
      if (fileObj.data && fileObj.name) {
        var result = uploadFileToDriveEx(fileObj.data, fileObj.name);
        if (result && result.url) filesList.push(result);
      }
    }
  }
  
  var finalFilesString = filesList.length > 0 ? JSON.stringify(filesList) : '';
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return h.toString().trim(); });
  var favIdx = headers.indexOf("收藏");
  if (favIdx === -1) {
    sheet.getRange(1, 11).setValue("收藏");
    favIdx = 10;
  }
  
  var rowData = [
    formData.action === 'edit' ? null : generateNextId(), 
    formData.category,      
    formData.name,          
    formData.description,   
    formData.specification, 
    formData.tools,         
    finalFilesString,       
    formData.source,        
    now,                    
    formData.gemUrl,        
    formData.isFavorite ? "TRUE" : "FALSE" 
  ];
  
  if (formData.action === 'edit' && formData.rowIndex) {
    var r = parseInt(formData.rowIndex, 10);
    sheet.getRange(r, 2, 1, 10).setValues([[
      rowData[1], rowData[2], rowData[3], rowData[4], rowData[5], rowData[6], rowData[7], rowData[8], rowData[9], rowData[10]
    ]]);
    return { status: 'success', message: '資料更新成功！' };
  } else {
    sheet.appendRow(rowData);
    return { status: 'success', message: '資料新增成功！' };
  }
}

/**
 * 上傳檔案至 Google Drive (優先使用指定的 DRIVE_FOLDER_ID)
 */
function uploadFileToDriveEx(base64Data, fileName) {
  try {
    var folder;
    // 💡 優先使用指定的資料夾 ID 載入
    if (DRIVE_FOLDER_ID && DRIVE_FOLDER_ID.trim() !== '') {
      try {
        folder = DriveApp.getFolderById(DRIVE_FOLDER_ID.trim());
      } catch (err) {
        Logger.log("無法使用 DRIVE_FOLDER_ID 取得資料夾，將使用名稱搜尋備用方案: " + err.toString());
      }
    }
    
    // 💡 備用方案：若 ID 無效或為空，則透過名稱搜尋或新建
    if (!folder) {
      var folders = DriveApp.getFoldersByName(TARGET_FOLDER_NAME);
      if (folders.hasNext()) { 
        folder = folders.next(); 
      } else { 
        folder = DriveApp.createFolder(TARGET_FOLDER_NAME); 
      }
    }
    
    var splitData = base64Data.split(',');
    var contentType = splitData[0].match(/:(.*?);/)[1];
    var bytes = Utilities.base64Decode(splitData[1]);
    var blob = Utilities.newBlob(bytes, contentType, fileName);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { name: fileName, url: file.getUrl(), id: file.getId() };
  } catch (error) { 
    Logger.log("上傳檔案失敗: " + error.toString());
    return null; 
  }
}

/**
 * 刪除整筆 Gem 資料與實體附件
 */
function deleteGemRecord(rowIndex) {
  try {
    var sheet = getSpreadsheet().getSheetByName(SPREADSHEET_SHEET_NAME);
    var r = parseInt(rowIndex, 10);
    if (isNaN(r) || r <= 1 || r > sheet.getLastRow()) return { status: 'error', message: '刪除失敗：無效位置' };
    
    var filesValue = sheet.getRange(r, 7).getValue().toString().trim();
    if (filesValue !== '' && filesValue.indexOf('[') === 0) {
      try {
        var filesArr = JSON.parse(filesValue);
        for (var i = 0; i < filesArr.length; i++) {
          var fileObj = filesArr[i];
          if (fileObj.id) try { DriveApp.getFileById(fileObj.id).setTrashed(true); } catch(fErr) {}
        }
      } catch(e) {}
    }
    sheet.deleteRow(r);
    return { status: "success", message: "資料已移除。" };
  } catch (error) { return { status: 'error', message: '刪除失敗：' + error.toString() }; }
}

/**
 * 同步刪除單一歷史檔案
 */
function deleteFileFromDrive(rowIndex, fileId, currentFilesJson) {
  try {
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
    var list = [];
    try { list = JSON.parse(currentFilesJson); } catch(e) { list = []; }
    var updatedList = list.filter(function(item) { return item.id !== fileId; });
    var finalString = updatedList.length > 0 ? JSON.stringify(updatedList) : '';
    var sheet = getSpreadsheet().getSheetByName(SPREADSHEET_SHEET_NAME);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return h.toString().trim(); });
    var infoIdx = headers.indexOf("相關資訊");
    if (infoIdx !== -1) sheet.getRange(parseInt(rowIndex, 10), infoIdx + 1).setValue(finalString);
    return { status: 'success', message: '檔案已成功移除！', updatedJson: finalString };
  } catch (error) { return { status: 'error', message: '檔案刪除失敗：' + error.toString() }; }
}

/**
 * ====================================================================
 * 一次性遷移工具：將舊資料夾 (Google Gem Reference) 中的所有檔案搬移到新資料夾 (Reference)
 * 💡 搬移後，檔案的 ID 與 URL 保持不變，因此試算表中的連結依然有效
 * ====================================================================
 */
function migrateFilesToNewFolder() {
  var oldFolderName = "Google Gem Reference";
  var newFolderId = DRIVE_FOLDER_ID;
  
  try {
    var newFolder = DriveApp.getFolderById(newFolderId);
    var oldFolders = DriveApp.getFoldersByName(oldFolderName);
    
    if (!oldFolders.hasNext()) {
      Logger.log("找不到舊資料夾: " + oldFolderName);
      return "找不到舊資料夾: " + oldFolderName;
    }
    
    var oldFolder = oldFolders.next();
    var files = oldFolder.getFiles();
    var count = 0;
    
    while (files.hasNext()) {
      var file = files.next();
      file.moveTo(newFolder);
      count++;
      Logger.log("已搬移檔案: " + file.getName() + " (ID: " + file.getId() + ")");
    }
    
    Logger.log("遷移完成！共搬移了 " + count + " 個檔案。");
    return "遷移完成！共搬移了 " + count + " 個檔案。";
  } catch (err) {
    Logger.log("遷移失敗: " + err.toString());
    return "遷移失敗: " + err.toString();
  }
}
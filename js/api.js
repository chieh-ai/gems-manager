/**
 * ====================================================================
 * Gems Manager - 後端 API 連線與異常攔截模組 (js/api.js)
 * ====================================================================
 */

import { getAccessCode, clearAccessCode } from './cache.js';

// ⚠️ Google Apps Script 穩定部署端點
export const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwfb3ZTFzP7H0OgzsoBAxrFK1b3sZITa7kHSh-IxtWQree7ONqyuChs91zSjHyXuit4/exec";

/**
 * 通用回應處理程序：攔截未授權錯誤 (auth_failed)
 */
function handleResponse(res) {
  if (res.code === 'auth_failed') {
    clearAccessCode();
    // 拋出特定錯誤，讓主程式能捕獲並顯示登入視窗
    throw new Error('AUTH_FAILED');
  }
  return res;
}

/**
 * 取得雲端 Gems 提示詞列表
 */
export async function fetchGemsListAPI() {
  const code = getAccessCode();
  const url = `${GAS_API_URL}?action=getGemList&accessCode=${encodeURIComponent(code)}`;
  const response = await fetch(url);
  const data = await response.json();
  return handleResponse(data);
}

/**
 * 取得雲端已註冊分類清單
 */
export async function fetchCategoryOptionsAPI() {
  const code = getAccessCode();
  const url = `${GAS_API_URL}?action=getCategoryOptions&accessCode=${encodeURIComponent(code)}`;
  const response = await fetch(url);
  const data = await response.json();
  return handleResponse(data);
}

/**
 * 新增或修改 Gem 資料記錄 (含 base64 檔案資料)
 */
export async function saveGemRecordAPI(formData) {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: JSON.stringify({
      action: 'saveGemData',
      accessCode: getAccessCode(),
      formData: formData
    })
  });
  const data = await response.json();
  return handleResponse(data);
}

/**
 * 刪除整筆 Gem 資料記錄
 */
export async function deleteGemRecordAPI(rowIndex) {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: JSON.stringify({
      action: 'deleteGemRecord',
      accessCode: getAccessCode(),
      rowIndex: rowIndex
    })
  });
  const data = await response.json();
  return handleResponse(data);
}

/**
 * 刪除 Gem 關聯的單一雲端附件檔案
 */
export async function deleteFileAPI(rowIndex, fileId, currentJson) {
  const response = await fetch(GAS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: JSON.stringify({
      action: 'deleteFileFromDrive',
      accessCode: getAccessCode(),
      rowIndex: rowIndex,
      fileId: fileId,
      currentFilesJson: currentJson
    })
  });
  const data = await response.json();
  return handleResponse(data);
}

/**
 * ====================================================================
 * Gems Manager - 本地快取與金鑰安全防護模組 (js/cache.js)
 * ====================================================================
 */

// 🛡️ 取得金鑰認證
export function getAccessCode() {
  return localStorage.getItem('gems_access_code') || '';
}

// 🛡️ 儲存金鑰認證
export function setAccessCode(code) {
  localStorage.setItem('gems_access_code', code);
}

// 🛡️ 清除金鑰與快取
export function clearAccessCode() {
  localStorage.removeItem('gems_access_code');
  clearGemsCache();
}

// 🛡️ 取得本地快取資料
export function getGemsCache() {
  try {
    const cached = localStorage.getItem('gems_manager_cache');
    return cached ? JSON.parse(cached) : null;
  } catch (e) {
    console.error('讀取本地快取失敗:', e);
    return null;
  }
}

// 🛡️ 設定本地快取資料與最後更新時間
export function setGemsCache(gems, time) {
  try {
    localStorage.setItem('gems_manager_cache', JSON.stringify(gems));
    localStorage.setItem('gems_manager_cache_time', time);
  } catch (e) {
    console.error('寫入本地快取失敗:', e);
  }
}

// 🛡️ 清除本地快取
export function clearGemsCache() {
  localStorage.removeItem('gems_manager_cache');
  localStorage.removeItem('gems_manager_cache_time');
}

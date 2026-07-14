/**
 * ====================================================================
 * Gems Manager - 前端 UI 渲染與事件監聽核心模組 (js/app.js)
 * ====================================================================
 */

import {
  getAccessCode,
  setAccessCode,
  clearAccessCode,
  getGemsCache,
  setGemsCache
} from './cache.js';

import {
  GAS_API_URL,
  fetchGemsListAPI,
  fetchCategoryOptionsAPI,
  saveGemRecordAPI,
  deleteGemRecordAPI,
  deleteFileAPI
} from './api.js';

// 🌐 全域變數定義
let allGems = [];
let currentCategory = '全部';
let currentPage = 1;
let pageSize = 10;

// 🎨 類別專屬 Emoji 對照表
const CATEGORY_EMOJIS = {
  '全部': '🌐', '影片生成': '🎬', '簡報生成': '📊', '簡報設計': '📐', '日常工作': '📅',
  '程式開發': '💻', '圖片生成': '🎨', '翻譯寫作': '✍️', '創意寫作': '📝', '網站設計': '🌐',
  '語言學習': '🗣️', 'Prompt 架構': '🏗️', '遊戲設計': '🎮', '逆向工程': '🔍', 'Agents': '🤖',
  'ZeroType': '⌨️', '出題系統': '📝', '教育行政': '🏫', '計劃案': '📁', '數理學習': '🧮',
  '教案設計': '📜', '其他': '🔮', '未分類': '💡'
};

/**
 * 依據類別名稱取得專屬 Emoji
 */
function getEmoji(categoryName) {
  if (!categoryName) return CATEGORY_EMOJIS['未分類'];
  const name = categoryName.toString().trim();
  if (name === '' || name === '全部') return CATEGORY_EMOJIS['全部'];
  if (CATEGORY_EMOJIS[name]) return CATEGORY_EMOJIS[name];
  for (let key in CATEGORY_EMOJIS) {
    if (name.includes(key) || key.includes(name)) return CATEGORY_EMOJIS[key];
  }
  return CATEGORY_EMOJIS['未分類'];
}

/**
 * 顯示/隱藏 金鑰驗證防護罩
 */
function showAuthModal(show) {
  const modal = document.getElementById('authModal');
  if (show) {
    modal.classList.remove('hidden');
    document.getElementById('authCodeInput').focus();
  } else {
    modal.classList.add('hidden');
  }
}

/**
 * 處理金鑰提交驗證
 */
function handleAuthSubmit() {
  const input = document.getElementById('authCodeInput').value.trim();
  if (!input) {
    showToast('請輸入訪問金鑰！', 'error');
    return;
  }
  setAccessCode(input);
  showAuthModal(false);
  initPageData();
}

/**
 * 統一初始化入口
 */
function initPageData() {
  const code = getAccessCode();
  if (!code) {
    showAuthModal(true);
    return;
  }

  // SWR 機制：先試著載入本地快取，完成瞬間秒開
  const cachedGems = getGemsCache();
  const cachedTime = localStorage.getItem('gems_manager_cache_time');
  
  if (cachedGems && cachedGems.length > 0) {
    allGems = cachedGems;
    document.getElementById('lastDeployTime').textContent = cachedTime || '快取載入';
    renderFilterSelect();
    renderTable();
    showLoading(false);
    // 背景靜默同步最新資料
    fetchGemData(true);
  } else {
    // 沒有快取，則進行阻擋式載入
    fetchGemData(false);
  }
  
  fetchCategoryOptions();
}

/**
 * 從後端同步資料庫並管理快取
 */
function fetchGemData(isSilent = false) {
  if (!isSilent) {
    showLoading(true);
  }
  fetchGemsListAPI()
    .then(res => {
      if (res.status === 'success') {
        const newGems = res.gems || [];
        const newTime = res.lastDeployTime || '未知';
        
        // 比對新舊資料結構是否完全一致
        const oldGemsStr = localStorage.getItem('gems_manager_cache');
        const newGemsStr = JSON.stringify(newGems);
        
        // 如果資料有變動，或者不是靜默讀取，則進行重繪與快取更新
        if (oldGemsStr !== newGemsStr || !isSilent) {
          allGems = newGems;
          document.getElementById('lastDeployTime').textContent = newTime;
          setGemsCache(newGems, newTime);
          renderFilterSelect(); 
          renderTable();
          
          if (isSilent && oldGemsStr) {
            showToast('雲端資料已同步更新！', 'success');
          }
        }
      } else {
        showToast('資料載入失敗: ' + (res.message || '未知錯誤'), 'error');
      }
      showLoading(false);
    })
    .catch(err => {
      showLoading(false);
      if (err.message === 'AUTH_FAILED') {
        showToast('金鑰驗證失效，請重新輸入。', 'error');
        showAuthModal(true);
      } else {
        showToast('無法連線至雲端資料庫: ' + err, 'error');
      }
    });
}

/**
 * 載入表單所需的分類下拉選項
 */
function fetchCategoryOptions() {
  fetchCategoryOptionsAPI()
    .then(res => {
      if (res.status === 'success' && res.categories) {
        const select = document.getElementById('gemCategory');
        if (select) {
          select.innerHTML = '<option value="" disabled selected hidden>請選擇 Gem 類別...</option>';
          res.categories.forEach(cat => {
            if (cat && cat.toString().trim() !== '') {
              const opt = document.createElement('option');
              opt.value = cat.toString().trim();
              opt.textContent = `${getEmoji(cat)} ${cat}`;
              select.appendChild(opt);
            }
          });
        }
      }
    })
    .catch(err => {
      if (err.message === 'AUTH_FAILED') {
        showAuthModal(true);
      } else {
        console.error('無法載入分類選項:', err);
      }
    });
}

/**
 * 繪製分類篩選選單
 */
function renderFilterSelect() {
  const select = document.getElementById('categoryFilterSelect');
  const rawCategories = allGems.map(item => item['Gem類別']).filter(Boolean);
  const uniqueCats = [...new Set(rawCategories)];
  select.innerHTML = '<option value="全部">🌐 全部類別</option>';
  uniqueCats.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.toString().trim();
    opt.textContent = `${getEmoji(cat)} ${cat}`;
    if (currentCategory === cat.toString().trim()) opt.selected = true;
    select.appendChild(opt);
  });
}

/**
 * 篩選與分頁重繪表格
 */
function renderTable() {
  const tbody = document.getElementById('gemTableBody');
  const searchKeyword = document.getElementById('searchInput').value.trim().toLowerCase();
  const isFavOnlyChecked = document.getElementById('globalFavoriteFilter').checked;
  
  tbody.innerHTML = '';

  const filtered = allGems.filter(item => {
    const matchCategory = (currentCategory === '全部' || item['Gem類別'] === currentCategory);
    const matchSearch = (!searchKeyword || (item['Gem名稱'] && item['Gem名稱'].toLowerCase().includes(searchKeyword)));
    const isItemFav = item['收藏'] && (item['收藏'].toString().toUpperCase() === 'TRUE' || item['收藏'] === true);
    const matchFavorite = !isFavOnlyChecked || isItemFav;
    
    return matchCategory && matchSearch && matchFavorite;
  });

  document.getElementById('totalRecordsText').textContent = filtered.length;

  if (filtered.length === 0) {
    document.getElementById('tableContainer').classList.remove('hidden');
    document.getElementById('emptyState').classList.remove('hidden');
    document.getElementById('paginationControlZone').classList.add('hidden'); 
    return;
  }

  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('tableContainer').classList.remove('hidden');
  document.getElementById('paginationControlZone').classList.remove('hidden');

  let displayData = [];
  let totalPages = 1;
  
  if (pageSize === 'all') {
    displayData = filtered;
    totalPages = 1;
    currentPage = 1;
  } else {
    const size = parseInt(pageSize, 10);
    totalPages = Math.ceil(filtered.length / size);
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * size;
    displayData = filtered.slice(startIdx, startIdx + size);
  }

  displayData.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50/70 transition';
    
    let filesHtml = '';
    if (item['相關資訊'] && item['相關資訊'].toString().trim() !== '') {
      const rawStr = item['相關資訊'].toString().trim();
      if (rawStr.indexOf('[') === 0) {
        try {
          const filesArr = JSON.parse(rawStr);
          filesArr.forEach(file => {
            filesHtml += `<a href="${file.url}" target="_blank" class="text-amber-600 hover:text-amber-700 ml-1.5" title="${file.name}"><i class="fa-solid fa-paperclip"></i></a>`;
          });
        } catch(e) {}
      }
    }

    const catName = item['Gem類別'] || '未分類';
    const isFav = item['收藏'] && (item['收藏'].toString().toUpperCase() === 'TRUE' || item['收藏'] === true);
    const favCellHtml = isFav 
      ? `<span class="text-amber-500 text-lg flex items-center justify-center" title="已收藏"><i class="fa-solid fa-star"></i></span>`
      : ``; 

    tr.innerHTML = `
      <td class="px-6 py-4 font-mono text-xs text-gray-500 font-semibold">${item['編號'] || '-'}</td>
      <td class="px-6 py-4 whitespace-nowrap"><span class="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-md font-medium">${getEmoji(catName)} ${catName}</span></td>
      <td class="px-6 py-4 font-medium text-gray-900">
        <span class="view-spec-btn cursor-pointer text-gray-900 hover:text-amber-600 hover:underline transition-all">
          ${item['Gem名稱'] || '-'}
        </span>
        ${filesHtml}
      </td>
      <td class="px-6 py-4 text-center whitespace-nowrap">${favCellHtml}</td>
      <td class="px-6 py-4 text-right space-x-1 whitespace-nowrap actions-cell"></td>
    `;

    // 點擊 Gem 名稱顯示規格查看彈窗
    tr.querySelector('.view-spec-btn').onclick = () => viewSpecification(item);

    const actionsCell = tr.querySelector('.actions-cell');
    
    // 連結按鈕
    const linkBtn = document.createElement('button');
    linkBtn.type = 'button';
    if (item['Gem連結'] && item['Gem連結'].toString().startsWith('http')) {
      linkBtn.className = 'cursor-pointer bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center space-x-1';
      linkBtn.onclick = () => window.open(item['Gem連結'].toString().trim(), '_blank');
    } else {
      linkBtn.className = 'bg-gray-50 border border-gray-200 text-gray-400 px-2.5 py-1.5 rounded-lg text-xs font-medium inline-flex items-center space-x-1 opacity-60 cursor-not-allowed';
      linkBtn.disabled = true;
    }
    linkBtn.innerHTML = '<i class="fa-solid fa-arrow-up-right-from-square"></i><span>連結</span>';

    // 複製按鈕
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'cursor-pointer bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center space-x-1';
    copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i><span>複製</span>';
    copyBtn.onclick = () => copyText(item['使用說明（需求規格）'] || '');

    // 編輯按鈕
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'cursor-pointer bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg text-xs font-medium transition inline-flex items-center space-x-1';
    editBtn.innerHTML = '<i class="fa-regular fa-pen-to-square"></i><span>編輯</span>';
    editBtn.onclick = () => openFormModal('edit', item);

    actionsCell.appendChild(linkBtn);
    actionsCell.appendChild(copyBtn);
    actionsCell.appendChild(editBtn);
    tbody.appendChild(tr);
  });

  buildPaginationButtons(totalPages);
}

/**
 * 繪製分頁按鈕
 */
function buildPaginationButtons(totalPages) {
  const container = document.getElementById('paginationButtons');
  container.innerHTML = '';
  if (totalPages <= 1) return;

  const btnBaseClass = "px-2.5 py-1 rounded-md text-xs font-medium transition-all shadow-xs border ";
  const activeClass = "bg-amber-500 text-white border-amber-500 font-bold shadow-xs";
  const inactiveClass = "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 cursor-pointer";
  const disabledClass = "bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed";

  // 上一頁
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.innerHTML = '<i class="fa-solid fa-angle-left"></i>';
  if (currentPage === 1) {
    prevBtn.className = btnBaseClass + disabledClass; prevBtn.disabled = true;
  } else {
    prevBtn.className = btnBaseClass + inactiveClass; prevBtn.onclick = () => { currentPage--; renderTable(); };
  }
  container.appendChild(prevBtn);

  // 頁碼
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement('button');
    pageBtn.type = 'button'; pageBtn.textContent = i;
    pageBtn.className = btnBaseClass + (i === currentPage ? activeClass : inactiveClass);
    if (i !== currentPage) pageBtn.onclick = () => { currentPage = i; renderTable(); };
    container.appendChild(pageBtn);
  }

  // 下一頁
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button'; nextBtn.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
  if (currentPage === totalPages) {
    nextBtn.className = btnBaseClass + disabledClass; nextBtn.disabled = true;
  } else {
    nextBtn.className = btnBaseClass + inactiveClass; nextBtn.onclick = () => { currentPage++; renderTable(); };
  }
  container.appendChild(nextBtn);
}

/**
 * 開啟新增/編輯表單彈窗
 */
function openFormModal(action, item = null) {
  document.getElementById('gemForm').reset();
  document.getElementById('formAction').value = action;
  document.getElementById('newFilesList').classList.add('hidden');
  document.getElementById('newFilesUl').innerHTML = '';
  
  const historyZone = document.getElementById('historyFilesZone');
  const historyContainer = document.getElementById('historyFilesContainer');
  historyContainer.innerHTML = ''; historyZone.classList.add('hidden');
  
  if (action === 'add') {
    document.getElementById('modalTitle').textContent = '新增 Google Gem';
    document.getElementById('formRowIndex').value = '';
    document.getElementById('formFileUrl').value = '';
    document.getElementById('gemUrl').value = ''; 
    document.getElementById('gemIsFavorite').checked = false; 
    document.getElementById('submitBtnText').textContent = '確認新增';
  } else if (action === 'edit' && item) {
    document.getElementById('modalTitle').textContent = `編輯 Gem 資料 (${item['編號']})`;
    document.getElementById('formRowIndex').value = item.rowIndex;
    document.getElementById('gemCategory').value = item['Gem類別'] || '';
    document.getElementById('gemName').value = item['Gem名稱'] || '';
    document.getElementById('gemDescription').value = item['說明（使用者）'] || '';
    document.getElementById('gemSpecification').value = item['使用說明（需求規格）'] || '';
    document.getElementById('gemTools').value = item['預設工具'] || '';
    document.getElementById('gemSource').value = item['來源'] || '';
    document.getElementById('formFileUrl').value = item['相關資訊'] || '';
    document.getElementById('gemUrl').value = item['Gem連結'] || ''; 
    
    const isFav = item['收藏'] && (item['收藏'].toString().toUpperCase() === 'TRUE' || item['收藏'] === true);
    document.getElementById('gemIsFavorite').checked = isFav;
    
    if (item['相關資訊'] && item['相關資訊'].toString().trim() !== '') {
      const rawStr = item['相關資訊'].toString().trim();
      if (rawStr.indexOf('[') === 0) {
        try {
          const filesArr = JSON.parse(rawStr);
          if (filesArr.length > 0) {
            historyZone.classList.remove('hidden');
            filesArr.forEach(file => {
              const div = document.createElement('div');
              div.className = "flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-gray-200 text-xs shadow-xs hover:border-gray-300 transition";
              div.innerHTML = `
                <div class="flex items-center space-x-2 truncate pr-2">
                  <i class="fa-solid fa-file-lines text-amber-500 flex-shrink-0"></i>
                  <a href="${file.url}" target="_blank" class="text-gray-700 font-medium hover:text-amber-600 truncate underline" title="${file.name}">${file.name}</a>
                </div>
              `;
              const delBtn = document.createElement('button');
              delBtn.type = 'button';
              delBtn.className = "cursor-pointer text-gray-400 hover:text-rose-500 p-1 transition flex-shrink-0";
              delBtn.innerHTML = '<i class="fa-regular fa-trash-can text-sm"></i>';
              delBtn.onclick = () => executeFileDelete(item.rowIndex, file.id, item['相關資訊'], div);
              div.appendChild(delBtn);
              historyContainer.appendChild(div);
            });
          }
        } catch(e) {}
      }
    }
  }
  
  document.getElementById('deleteGemRecordBtn').classList.toggle('hidden', action === 'add');
  document.getElementById('formModal').classList.remove('hidden');
}

/**
 * 執行附件檔案刪除
 */
function executeFileDelete(rowIndex, fileId, currentJson, elementJson) {
  if (!confirm('⚠️ 確定要從 Google Drive 雲端硬碟中實體刪除此檔案嗎？')) return;
  elementJson.style.opacity = '0.5';
  
  deleteFileAPI(rowIndex, fileId, currentJson)
    .then(result => {
      if (result.status === 'success') {
        showToast(result.message, 'success'); 
        elementJson.remove();
        document.getElementById('formFileUrl').value = result.updatedJson;
        const target = allGems.find(g => g.rowIndex == rowIndex);
        if (target) target['相關資訊'] = result.updatedJson;
        
        // 同步更新快取
        setGemsCache(allGems, document.getElementById('lastDeployTime').textContent);
        
        renderTable(); 
        if (result.updatedJson === '' || result.updatedJson === '[]') {
          document.getElementById('historyFilesZone').classList.add('hidden');
        }
      } else {
        showToast(result.message || '檔案刪除失敗', 'error');
        elementJson.style.opacity = '1';
      }
    })
    .catch(err => {
      elementJson.style.opacity = '1';
      if (err.message === 'AUTH_FAILED') {
        showToast('金鑰已失效，請重新解鎖。', 'error');
        showAuthModal(true);
      } else {
        showToast('無法連線到伺服器: ' + err, 'error');
      }
    });
}

/**
 * 呈現規格查看彈窗
 */
function viewSpecification(item) {
  document.getElementById('viewId').textContent = item['編號'] || 'GEM-000';
  document.getElementById('viewName').textContent = item['Gem名稱'] || '未命名 Gem';
  document.getElementById('viewSpecification').textContent = item['使用說明（需求規格）'] || '（無內容）';
  document.getElementById('viewCopyBtn').onclick = () => copyText(item['使用說明（需求規格）'] || '');

  // 說明用途展示
  const descZone = document.getElementById('viewDescriptionZone');
  const desc = document.getElementById('viewDescription');
  if (item['說明（使用者）'] && item['說明（使用者）'].toString().trim() !== '') {
    desc.textContent = item['說明（使用者）'].toString().trim();
    descZone.classList.remove('hidden');
  } else {
    descZone.classList.add('hidden');
  }

  // 預設工具展示
  const toolsZone = document.getElementById('viewToolsZone');
  const tools = document.getElementById('viewTools');
  if (item['預設工具'] && item['預設工具'].toString().trim() !== '') {
    tools.textContent = item['預設工具'].toString().trim();
    toolsZone.classList.remove('hidden');
  } else {
    toolsZone.classList.add('hidden');
  }

  // 來源展示
  const srcZone = document.getElementById('viewSourceZone');
  const src = document.getElementById('viewSource');
  if (item['來源'] && item['來源'].toString().trim() !== '') {
    src.textContent = item['來源'].toString().trim();
    srcZone.classList.remove('hidden');
  } else {
    srcZone.classList.add('hidden');
  }

  // 外部連結按鈕
  const urlBtn = document.getElementById('viewUrlBtn');
  if (item['Gem連結'] && item['Gem連結'].toString().startsWith('http')) {
    urlBtn.onclick = () => window.open(item['Gem連結'].toString().trim(), '_blank');
    urlBtn.classList.remove('hidden');
  } else {
    urlBtn.classList.add('hidden');
  }

  // 附件下載清單
  const filesZone = document.getElementById('viewFilesZone');
  const container = document.getElementById('viewFilesContainer');
  container.innerHTML = '';
  
  let filesArr = [];
  if (item['相關資訊'] && item['相關資訊'].toString().trim() !== '') {
    const rawStr = item['相關資訊'].toString().trim();
    if (rawStr.indexOf('[') === 0) {
      try {
        filesArr = JSON.parse(rawStr);
      } catch(e) {
        filesArr = [];
      }
    }
  }

  if (filesArr.length > 0) {
    filesArr.forEach(file => {
      const a = document.createElement('a');
      a.href = file.url;
      a.target = '_blank';
      a.className = "flex items-center space-x-2 bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-2 rounded-lg border border-amber-200 text-xs font-semibold transition truncate";
      a.innerHTML = `
        <i class="fa-solid fa-file-arrow-down text-amber-600 flex-shrink-0 text-sm"></i>
        <span class="truncate underline text-left" title="${file.name}">${file.name}</span>
      `;
      container.appendChild(a);
    });
    filesZone.classList.remove('hidden');
  } else {
    filesZone.classList.add('hidden');
  }

  document.getElementById('viewModal').classList.remove('hidden');
}

/**
 * 處理表單欄位提交
 */
function handleFormSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  const category = document.getElementById('gemCategory').value;
  const name = document.getElementById('gemName').value.trim();
  const specification = document.getElementById('gemSpecification').value.trim();
  
  if (!category || !name || !specification) {
    showToast('請填寫必填欄位！', 'error');
    return;
  }

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;

  const formData = {
    action: document.getElementById('formAction').value,
    rowIndex: document.getElementById('formRowIndex').value,
    category: category,
    name: name,
    description: document.getElementById('gemDescription').value.trim(),
    specification: specification,
    tools: document.getElementById('gemTools').value.trim(),
    source: document.getElementById('gemSource').value.trim(),
    fileUrl: document.getElementById('formFileUrl').value,
    gemUrl: document.getElementById('gemUrl').value.trim(), 
    isFavorite: document.getElementById('gemIsFavorite').checked, 
    filesArray: []
  };

  const fileInput = document.getElementById('gemFile');
  if (fileInput.files.length > 0) {
    document.getElementById('submitBtnText').textContent = '正在處理檔案...';
    const readPromises = Array.from(fileInput.files).map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve({ data: evt.target.result, name: file.name });
        reader.readAsDataURL(file);
      });
    });
    Promise.all(readPromises).then(results => {
      formData.filesArray = results;
      sendDataToBackend(formData);
    });
  } else {
    sendDataToBackend(formData);
  }
}

/**
 * 送出表單資料到後端
 */
function sendDataToBackend(formData) {
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  
  saveGemRecordAPI(formData)
    .then(result => {
      submitBtn.disabled = false;
      submitBtnText.textContent = '儲存資料';
      if (result.status === 'success') {
        showToast(result.message, 'success');
        closeModal('formModal');
        currentPage = 1;
        fetchGemData(false); // 強制進行阻擋式同步，重置快取
      } else {
        showToast(result.message || '儲存失敗', 'error');
      }
    })
    .catch(err => {
      submitBtn.disabled = false;
      submitBtnText.textContent = '儲存資料';
      if (err.message === 'AUTH_FAILED') {
        showToast('金鑰驗證失效，請重新解鎖。', 'error');
        showAuthModal(true);
      } else {
        showToast('無法連線到伺服器: ' + err, 'error');
      }
    });
}

/**
 * 處理資料整筆刪除
 */
function handleRecordDelete() {
  const rowIndex = document.getElementById('formRowIndex').value;
  if (!confirm('⚠️ 確定要刪除這筆 Gem 資料嗎？')) return;
  
  const deleteBtn = document.getElementById('deleteGemRecordBtn');
  deleteBtn.disabled = true;

  deleteGemRecordAPI(rowIndex)
    .then(result => {
      deleteBtn.disabled = false;
      if (result.status === 'success') {
        showToast(result.message || '資料已移除', 'success');
        closeModal('formModal'); 
        fetchGemData(false); // 強制同步
      } else {
        showToast(result.message || '刪除失敗', 'error');
      }
    })
    .catch(err => {
      deleteBtn.disabled = false;
      if (err.message === 'AUTH_FAILED') {
        showToast('金鑰驗證失效，請重新解鎖。', 'error');
        showAuthModal(true);
      } else {
        showToast('無法連線到伺服器: ' + err, 'error');
      }
    });
}

// 🌐 共用工具函式與導出給 HTML 的全域綁定
window.closeModal = closeModal;
window.openFormModal = openFormModal;
window.handleRecordDelete = handleRecordDelete;
window.executeFileDelete = executeFileDelete;
window.handleFormSubmit = handleFormSubmit;
window.handleAuthSubmit = handleAuthSubmit;
window.handleCategoryFilterChange = handleCategoryFilterChange;
window.handleGlobalFavoriteFilterChange = handleGlobalFavoriteFilterChange;
window.handlePageSizeChange = handlePageSizeChange;

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function handleCategoryFilterChange() {
  currentCategory = document.getElementById('categoryFilterSelect').value;
  currentPage = 1; 
  renderTable();
}

function handleGlobalFavoriteFilterChange() {
  currentPage = 1; 
  renderTable();
}

function handlePageSizeChange() {
  pageSize = document.getElementById('pageSizeSelect').value;
  currentPage = 1;
  renderTable();
}

function copyText(text) {
  navigator.clipboard.writeText(text).then(() => showToast('規格內容已成功複製！', 'success'));
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  document.getElementById('toastMessage').textContent = message;
  document.getElementById('toastIcon').className = type === 'success' ? "fa-solid fa-circle-check text-emerald-400" : "fa-solid fa-circle-exclamation text-rose-400";
  toast.classList.remove('translate-y-10', 'opacity-0', 'pointer-events-none');
  setTimeout(() => { toast.classList.add('translate-y-10', 'opacity-0', 'pointer-events-none'); }, 3000);
}

function showLoading(isLoading) {
  document.getElementById('loadingStatus').classList.toggle('hidden', !isLoading);
}

// 🚀 DOM 事件初始化綁定
document.addEventListener('DOMContentLoaded', () => {
  // 檔案選取監聽器
  document.getElementById('gemFile').addEventListener('change', (e) => {
    const listDiv = document.getElementById('newFilesList');
    const ul = document.getElementById('newFilesUl');
    ul.innerHTML = '';
    if (e.target.files.length > 0) {
      listDiv.classList.remove('hidden');
      Array.from(e.target.files).forEach(file => {
        const li = document.createElement('li');
        li.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        ul.appendChild(li);
      });
    } else {
      listDiv.classList.add('hidden');
    }
  });

  // 金鑰輸入框的 Enter 鍵
  document.getElementById('authCodeInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAuthSubmit();
  });

  // 關鍵字搜尋即時監聽
  document.getElementById('searchInput').addEventListener('input', () => {
    currentPage = 1;
    renderTable();
  });

  // 統一初始化載入
  initPageData();
});

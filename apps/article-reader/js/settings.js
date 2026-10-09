// ============================================================
//  SETTINGS — API Key 配置（硅基流动）
// ============================================================

(function() {
  var settingsBtn = document.getElementById('settingsBtn');
  var settingsModal = document.getElementById('settingsModal');
  var settingsCancel = document.getElementById('settingsCancel');
  var settingsSave = document.getElementById('settingsSave');
  var settingsKeyInput = document.getElementById('settingsSiliconflowKey');

  if (!settingsBtn || !settingsModal) return;

  function openSettings() {
    // 加载已保存的 key 到输入框
    try {
      var savedKey = localStorage.getItem('key:siliconflow');
      if (savedKey && settingsKeyInput) settingsKeyInput.value = savedKey;
    } catch (e) {}
    settingsModal.classList.add('show');
  }

  function closeSettings() {
    settingsModal.classList.remove('show');
  }

  settingsBtn.addEventListener('click', openSettings);
  if (settingsCancel) settingsCancel.addEventListener('click', closeSettings);

  // 点击遮罩关闭
  settingsModal.addEventListener('click', function(e) {
    if (e.target === settingsModal) closeSettings();
  });

  // 保存
  if (settingsSave) {
    settingsSave.addEventListener('click', function() {
      var key = settingsKeyInput ? settingsKeyInput.value.trim() : '';
      try {
        if (key) {
          localStorage.setItem('key:siliconflow', key);
        } else {
          localStorage.removeItem('key:siliconflow');
        }
      } catch (e) {}
      closeSettings();
      if (typeof showToast === 'function') {
        showToast(key ? 'API Key 已保存' : 'API Key 已清除', key ? 'success' : 'info');
      }
    });
  }

  // ESC 关闭
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && settingsModal.classList.contains('show')) {
      closeSettings();
    }
  });
})();

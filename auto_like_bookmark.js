javascript:(function () {
  function createProgressContainer() {
    var progressDiv = document.createElement('div');
    progressDiv.id = 'progressContainer';
    Object.assign(progressDiv.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '10px 15px',
      borderRadius: '8px',
      fontSize: '14px',
      zIndex: '9999',
      whiteSpace: 'pre-line'
    });
    document.body.appendChild(progressDiv);
    return progressDiv;
  }

  function updateProgress(div, current, total, msg) {
    div.innerText = '実行状況: ' + current + (total === '—' ? ' 件' : ' / ' + total) + '\n' + msg;
  }

  function getTweetDate(container) {
    var timeEl = container.querySelector('time[datetime]');
    if (!timeEl) return null;
    var dt = new Date(timeEl.getAttribute('datetime'));
    return isNaN(dt.getTime()) ? null : dt;
  }

  function run(actionType, repeatCount, startDateStr, endDateStr) {
    repeatCount = Math.max(1, parseInt(repeatCount, 10) || 5);
    var progressDiv = createProgressContainer();
    var successCount = 0;
    var startDate = null;
    var endDate = null;
    if (startDateStr && startDateStr.trim()) {
      startDate = new Date(startDateStr.trim());
      startDate.setHours(0, 0, 0, 0);
    }
    if (endDateStr && endDateStr.trim()) {
      endDate = new Date(endDateStr.trim());
      endDate.setHours(23, 59, 59, 999);
    }
    var useDateFilter = startDate !== null || endDate !== null;
    var reloadRetryTimeout = null;
    var totalDisplayFn = function () { return useDateFilter ? '—' : repeatCount; };
    var stepFn;
    function quickRetry() {
      setTimeout(function () { stepFn(); }, 500);
    }
    function scheduleRetry() {
      if (reloadRetryTimeout) return;
      if (currentInterval) {
        try { clearInterval(currentInterval); } catch (err) {}
        currentInterval = null;
      }
      if (!document.body.contains(progressDiv)) {
        progressDiv = createProgressContainer();
      }
      try {
        updateProgress(progressDiv, successCount, totalDisplayFn(), '再読み込みを検知、待機中... (3秒後に再開)');
      } catch (err) {}
      reloadRetryTimeout = setTimeout(function () {
        reloadRetryTimeout = null;
        try {
          if (!document.body.contains(progressDiv)) progressDiv = createProgressContainer();
          updateProgress(progressDiv, successCount, totalDisplayFn(), '再開中...');
        } catch (err) {}
        setTimeout(function () {
          try {
            stepFn();
          } catch (err) {
            console.error(err);
            scheduleRetry();
          }
        }, 0);
      }, 3000);
    }
    var mutationDebounce = null;
    var observer = new MutationObserver(function (mutations) {
      if (isActivelyProcessing) return;
      var removed = 0;
      for (var m = 0; m < mutations.length; m++) {
        removed += (mutations[m].removedNodes && mutations[m].removedNodes.length) || 0;
      }
      if (removed < 3) return;
      if (mutationDebounce) clearTimeout(mutationDebounce);
      mutationDebounce = setTimeout(function () {
        mutationDebounce = null;
        if (isActivelyProcessing) return;
        scheduleRetry();
      }, 800);
    });
    var observeTarget = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main') || document.body;
    observer.observe(observeTarget, { childList: true, subtree: true });
    function labelMatchesAny(label, candidates, exclude) {
      if (!label) return false;
      if (exclude) {
        var exc = Array.isArray(exclude) ? exclude : [exclude];
        for (var e = 0; e < exc.length; e++) {
          if (label.indexOf(exc[e]) !== -1) return false;
        }
      }
      var arr = Array.isArray(candidates) ? candidates : [candidates];
      for (var c = 0; c < arr.length; c++) {
        if (label.indexOf(arr[c]) !== -1) return true;
      }
      return false;
    }
    var actions;
    if (actionType === 'like') {
      actions = [{ target: ['いいねする', 'Like'], done: ['いいねしました', 'Liked'], exclude: ['Liked'] }];
    } else if (actionType === 'unlike') {
      actions = [{ target: ['いいねしました', 'Liked'], done: ['いいねする', 'Like'] }];
    } else if (actionType === 'bookmark') {
      actions = [{ target: ['ブックマーク', 'Bookmark'], done: ['ブックマーク済み', 'Bookmarked'], exclude: ['Bookmarked'] }];
    } else if (actionType === 'unbookmark') {
      actions = [{ target: ['ブックマーク済み', 'Bookmarked'], done: ['ブックマーク', 'Bookmark'] }];
    } else if (actionType === 'both_on') {
      actions = [
        { target: ['いいねする', 'Like'], done: ['いいねしました', 'Liked'], exclude: ['Liked'] },
        { target: ['ブックマーク', 'Bookmark'], done: ['ブックマーク済み', 'Bookmarked'], exclude: ['Bookmarked'] }
      ];
    } else {
      actions = [
        { target: ['いいねしました', 'Liked'], done: ['いいねする', 'Like'] },
        { target: ['ブックマーク済み', 'Bookmarked'], done: ['ブックマーク', 'Bookmark'] }
      ];
    }

    var currentInterval = null;
    var isActivelyProcessing = false;
    var noTargetRetryCount = 0;
    var NO_TARGET_RETRY_MAX = 5;
    var stepCallCount = 0;
    stepFn = function step() {
      stepCallCount++;
      console.log('[DEBUG] step() 呼び出し', stepCallCount, new Date().toISOString());
      isActivelyProcessing = true;
      try {
        if (!document.body.contains(progressDiv)) {
          progressDiv = createProgressContainer();
        }
        try {
          updateProgress(progressDiv, successCount, totalDisplayFn(), '実行中... (step:' + stepCallCount + '回目)');
        } catch (err) {}
        var btnList = document.querySelectorAll('button[aria-label]');
        var allButtons = [];
        for (var b = 0; b < btnList.length; b++) {
          if (document.body.contains(btnList[b])) allButtons.push(btnList[b]);
        }
        var firstBtn = null;
        for (var i = 0; i < allButtons.length; i++) {
          if (!document.body.contains(allButtons[i])) continue;
          var label = allButtons[i].getAttribute('aria-label') || '';
          if (labelMatchesAny(label, actions[0].target, actions[0].exclude)) {
            var container = allButtons[i].closest('article') || allButtons[i].closest('[data-testid="tweet"]') || document.body;
            if (!document.body.contains(container)) continue;
            if (useDateFilter) {
              var tweetDate = getTweetDate(container);
              if (tweetDate === null) continue;
              if (startDate !== null && tweetDate < startDate) continue;
              if (endDate !== null && tweetDate > endDate) continue;
            }
            firstBtn = allButtons[i];
            break;
          }
        }
        if (firstBtn) {
          if (!document.body.contains(firstBtn)) {
            quickRetry();
            return;
          }
          var container = firstBtn.closest('article') || firstBtn.closest('[data-testid="tweet"]') || document.body;
          if (!document.body.contains(container)) {
            quickRetry();
            return;
          }
          try {
            firstBtn.scrollIntoView();
          } catch (err) {
            quickRetry();
            return;
          }
          function doClicks(index) {
            try {
              if (index >= actions.length) {
                setTimeout(function () {
                  try {
                    if (!document.body.contains(firstBtn) || !document.body.contains(container)) {
                      quickRetry();
                      return;
                    }
                    var newLabel = firstBtn.getAttribute('aria-label') || '';
                    if (labelMatchesAny(newLabel, actions[0].done)) {
                      successCount++;
                      noTargetRetryCount = 0;
                    }
                    var totalDisplay = totalDisplayFn();
                    var shouldContinue = useDateFilter || successCount < repeatCount;
                    if (shouldContinue) {
                      isActivelyProcessing = false;
                      var waitTime = 3000 + Math.floor(Math.random() * 5001);
                      var rem = Math.floor(waitTime / 1000);
                      currentInterval = setInterval(function () {
                        try {
                          updateProgress(progressDiv, successCount, totalDisplay, '次の操作まで: ' + rem + '秒');
                          rem--;
                          if (rem < 0) {
                            clearInterval(currentInterval);
                            currentInterval = null;
                            if (reloadRetryTimeout) {
                              clearTimeout(reloadRetryTimeout);
                              reloadRetryTimeout = null;
                            }
                            step();
                          }
                        } catch (err) {
                          if (currentInterval) clearInterval(currentInterval);
                          currentInterval = null;
                          scheduleRetry();
                        }
                      }, 1000);
                    } else {
                      if (reloadRetryTimeout) return;
                      updateProgress(progressDiv, successCount, totalDisplay, '完了');
                      alert('処理が完了しました。');
                    }
                  } catch (err) {
                    scheduleRetry();
                  }
                }, 1000);
                return;
              }
              var act = actions[index];
              if (!document.body.contains(container)) {
                quickRetry();
                return;
              }
              var btns = container.querySelectorAll('button[aria-label]');
              var btn = null;
              for (var j = 0; j < btns.length; j++) {
                if (!document.body.contains(btns[j])) continue;
                var l = btns[j].getAttribute('aria-label') || '';
                if (labelMatchesAny(l, act.target, act.exclude)) {
                  btn = btns[j];
                  break;
                }
              }
              if (btn) {
                try { btn.click(); } catch (err) { quickRetry(); return; }
              }
              setTimeout(function () { doClicks(index + 1); }, 400);
            } catch (err) {
              quickRetry();
            }
          }
          doClicks(0);
        } else {
          var scrollEl = document.querySelector('[data-testid="primaryColumn"]') || document.querySelector('main');
          var canScrollWindow = window.innerHeight + window.scrollY < document.body.scrollHeight;
          var canScrollEl = scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight && (scrollEl.scrollTop + scrollEl.clientHeight < scrollEl.scrollHeight - 50);
          if (canScrollWindow) {
            try {
              updateProgress(progressDiv, successCount, totalDisplayFn(), '次のツイートを探しています...');
            } catch (err) {}
            window.scrollBy(0, 800);
            setTimeout(function () { stepFn(); }, 250);
          } else if (canScrollEl) {
            try {
              updateProgress(progressDiv, successCount, totalDisplayFn(), '次のツイートを探しています...');
            } catch (err) {}
            scrollEl.scrollBy(0, 800);
            setTimeout(function () { stepFn(); }, 250);
          } else {
            var totalDisplay = useDateFilter ? '—' : repeatCount;
            setTimeout(function () {
              if (reloadRetryTimeout) return;
              if (noTargetRetryCount < NO_TARGET_RETRY_MAX) {
                noTargetRetryCount++;
                try {
                  updateProgress(progressDiv, successCount, totalDisplay, 'ターゲットなし: 再試行 ' + noTargetRetryCount + '/' + NO_TARGET_RETRY_MAX + '...');
                } catch (err) {}
                scheduleRetry();
                return;
              }
              try {
                updateProgress(progressDiv, successCount, totalDisplay, 'ターゲットなし: 完了');
                alert('処理が完了しました。');
              } catch (err) {
                scheduleRetry();
              }
            }, 1000);
          }
        }
      } catch (e) {
        console.error(e);
        if (currentInterval) try { clearInterval(currentInterval); } catch (err) {}
        scheduleRetry();
      }
    };
    stepFn();
  }

  (function (callback) {
    var dlg = document.createElement('div');
    dlg.id = 'customDialog';
    dlg.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:Arial,sans-serif;';
    dlg.innerHTML = '<div style="position:relative;background:#f9f9f9;padding:0;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.3);width:300px;max-width:95vw;overflow:hidden;"><div style="background:#007BFF;padding:10px;text-align:center;"><span style="color:#fff;font-size:18px;">X 自動いいね・報告ツール</span></div><div style="padding:15px;"><div style="font-size:16px;color:#444;text-align:center;margin-bottom:15px;">設定オプション</div><label style="display:block;color:#555;margin-bottom:5px;">操作：</label><select id="actionType" style="width:100%;padding:8px 0;margin-bottom:15px;border:1px solid #ccc;border-radius:5px;box-sizing:border-box;text-align:center;"><option value="like">いいね</option><option value="unlike">いいね解除</option><option value="bookmark">ブックマーク</option><option value="unbookmark">ブックマーク解除</option><option value="both_on" selected>いいね&amp;ブックマーク（両方ON）</option><option value="both_off">いいね&amp;ブックマーク（両方OFF）</option></select><input type="hidden" id="repeatCount" value="5"/><label style="display:block;color:#555;margin-bottom:5px;">開始時期（任意）：</label><input type="date" id="startDate" style="width:100%;padding:8px;margin-bottom:15px;border:1px solid #ccc;border-radius:5px;box-sizing:border-box;text-align:center;"/><label style="display:block;color:#555;margin-bottom:5px;">終了時期（任意）：</label><input type="date" id="endDate" style="width:100%;padding:8px;margin-bottom:20px;border:1px solid #ccc;border-radius:5px;box-sizing:border-box;text-align:center;"/><button id="confirmButton" style="width:100%;padding:10px;background:#007BFF;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:16px;margin-bottom:10px;">開始</button><button id="closeButton" style="width:100%;padding:10px;background:#6c757d;color:#fff;border:none;border-radius:5px;cursor:pointer;font-size:16px;">閉じる</button></div></div>';
    document.body.appendChild(dlg);
    document.getElementById('confirmButton').addEventListener('click', function () {
      var act = document.getElementById('actionType').value;
      var count = document.getElementById('repeatCount').value;
      var startDate = document.getElementById('startDate').value || '';
      var endDate = document.getElementById('endDate').value || '';
      document.body.removeChild(dlg);
      callback(act, count, startDate, endDate);
    });
    document.getElementById('closeButton').addEventListener('click', function () {
      document.body.removeChild(dlg);
    });
  })(function (act, count, startDate, endDate) {
    run(act, count, startDate, endDate);
  });
})();

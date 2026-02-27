chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === "APPLYCONTROL_JOB_PAGE_STATUS") {
    const tabId = sender && sender.tab ? sender.tab.id : null;
    if (tabId == null) return;
    const enabled = !!msg.isJobPage;
    try {
      chrome.action.setBadgeText({
        tabId,
        text: enabled ? "JOB" : ""
      });
      chrome.action.setBadgeBackgroundColor({
        tabId,
        color: enabled ? "#1f7a1f" : "#999999"
      });
      if (enabled) chrome.action.enable(tabId);
      else chrome.action.disable(tabId);
    } catch {
      // Ignore if action API is unavailable.
    }
  }
});

export default defineBackground(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(console.error);
  const menuId = "pact-from-selection";
  const register = () => {
    chrome.contextMenus.remove(menuId, () => {
      void chrome.runtime.lastError;
      chrome.contextMenus.create({
        id: menuId,
        title: "Make a Pact from selection",
        contexts: ["selection"],
        documentUrlPatterns: ["http://*/*", "https://*/*"],
      });
    });
  };
  chrome.runtime.onInstalled.addListener(register);
  chrome.runtime.onStartup.addListener(register);
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    void chrome.storage.session
      .set({
        pactInvocation: { tabId: tab.id, windowId: tab.windowId },
        [`pactInvocation:${tab.windowId}`]: {
          tabId: tab.id,
          windowId: tab.windowId,
        },
      })
      .then(() =>
        chrome.runtime
          .sendMessage({
            type: "pact-invocation",
            tabId: tab.id,
            windowId: tab.windowId,
          })
          .catch(() => {}),
      );
    void chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  });
  chrome.commands.onCommand.addListener((command) => {
    if (command !== "open_pact") return;
    void chrome.windows.getCurrent().then((win) => {
      const windowId = win.id;
      if (windowId === undefined) return;
      void chrome.tabs.query({ active: true, windowId }).then(([tab]) => {
        if (tab?.id !== undefined) {
          void chrome.storage.session.set({
            pactInvocation: { tabId: tab.id, windowId },
            [`pactInvocation:${windowId}`]: {
              tabId: tab.id,
              windowId,
            },
          });
          void chrome.runtime
            .sendMessage({
              type: "pact-invocation",
              tabId: tab.id,
              windowId,
            })
            .catch(() => {});
        }
        void chrome.sidePanel.open({ windowId }).catch(console.error);
      });
    });
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (
      info.menuItemId !== menuId ||
      tab?.id === undefined ||
      !info.selectionText ||
      !info.pageUrl
    )
      return;
    const selection = {
      id: crypto.randomUUID(),
      tabId: tab.id,
      windowId: tab.windowId,
      url: info.pageUrl,
      text: info.selectionText.slice(0, 6000),
      at: Date.now(),
      frameId: info.frameId,
    };
    void chrome.storage.session
      .set({
        pactInvocation: { tabId: tab.id, windowId: tab.windowId },
        [`pactInvocation:${tab.windowId}`]: {
          tabId: tab.id,
          windowId: tab.windowId,
        },
        pactSelection: selection,
      })
      .then(() =>
        chrome.runtime
          .sendMessage({ type: "pact-selection", selection })
          .catch(() => {}),
      );
    void chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  });
});

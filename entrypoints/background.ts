export default defineBackground(() => {
  // The actual action invocation supplies the right tab even across multiple windows.
  // Open synchronously from this user gesture; don't rely on the focused window later.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(console.error);
  chrome.action.onClicked.addListener((tab) => {
    if (tab.id === undefined) return;
    void chrome.storage.session.set({
      pactInvocation: { tabId: tab.id, windowId: tab.windowId },
    }).then(() => chrome.runtime.sendMessage({type:'pact-invocation'}).catch(() => {}));
    void chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
  });
});

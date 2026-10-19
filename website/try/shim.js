// Web-demo shim: the panel runs as a normal web page, so chrome.* APIs are absent.
window.chrome = window.chrome || {};
document.documentElement.dataset.web = '1';
const style = document.createElement('style');
style.textContent = '[data-web] .summarize-btn{display:none!important}';
document.head.appendChild(style);

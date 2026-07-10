let currentText = '';
let dismissed = false;

document.getElementById('collectBtn').addEventListener('click', () => {
  if (dismissed) return;
  dismissed = true;
  window.electronAPI.saveText(currentText);
  window.electronAPI.skipText();
});

setTimeout(() => {
  if (!dismissed) {
    dismissed = true;
    window.electronAPI.skipText();
  }
}, 3000);

window.electronAPI.onShowText((text) => {
  currentText = text;
});

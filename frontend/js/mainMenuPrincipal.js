document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.initAuth()) {
    return;
  }
});
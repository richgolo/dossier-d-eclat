document.getElementById('hamburger').addEventListener('click', () => document.getElementById('mobileMenu').classList.toggle('open'));

function closeMenu() {
  document.getElementById('mobileMenu').classList.remove('open');
}

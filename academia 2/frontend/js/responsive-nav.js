// Responsive Navigation for Maseno LMS
let sidebarOpen = false;

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const main = document.querySelector('.main');
  const overlay = document.querySelector('.sidebar-overlay') || createOverlay();
  const hamburger = document.querySelector('.hamburger-menu');

  sidebarOpen = !sidebarOpen;

  if (sidebarOpen) {
    sidebar.classList.remove('mobile-hidden');
    main.classList.add('mobile-sidebar-open');
    overlay.classList.add('active');
    hamburger.textContent = '✕';
  } else {
    sidebar.classList.add('mobile-hidden');
    main.classList.remove('mobile-sidebar-open');
    overlay.classList.remove('active');
    hamburger.textContent = '☰';
  }
}

// ✅ Create overlay only if it doesn't exist (single instance)
function createOverlay() {
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = toggleSidebar;
    document.querySelector('.dashboard').appendChild(overlay);
  }
  return overlay;
}

// Close sidebar on mobile when clicking menu item
document.addEventListener('click', function(e) {
  if (e.target.closest('.sidebar li')) {
    if (window.innerWidth <= 1024) {
      toggleSidebar();
    }
  }
});

// Auto-close sidebar on resize to desktop
window.addEventListener('resize', function() {
  if (window.innerWidth > 1024) {
    const sidebar = document.querySelector('.sidebar');
    const main = document.querySelector('.main');
    const hamburger = document.querySelector('.hamburger-menu');
    
    sidebar.classList.remove('mobile-hidden');
    main.classList.remove('mobile-sidebar-open');
    if (hamburger) hamburger.textContent = '☰';
    sidebarOpen = false;
  }
});

// Initialize responsive nav
document.addEventListener('DOMContentLoaded', function() {
  if (window.innerWidth <= 1024) {
    document.querySelector('.sidebar').classList.add('mobile-hidden');
  }
  
  // Load responsive-nav early for all pages
  const hamburger = document.querySelector('.hamburger-menu');
  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });
  }
});

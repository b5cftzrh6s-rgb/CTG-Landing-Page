const NAV_LINKS = [
  { label: 'Home', href: 'index.html' },
  { label: 'Shell Control Correlation', href: 'shell-control-correlation.html' },
  { label: 'Shell Control Value Calculator', href: 'shell-control-value-calculator.html' },
  { label: 'Slurry Calculator', href: 'slurry-calculator.html' },
  { label: 'Tank RPM', href: 'tank-rpm-calculator.html' }
];

function initNavbar() {
  const navbarContainer = document.getElementById('navbar-container');
  if (!navbarContainer) return;

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  
  let navHTML = '<nav class="navbar"><div class="brand">CTG <span>|</span> Colloidal Technologies Group</div><ul>';
  
  NAV_LINKS.forEach(link => {
    const isActive = currentPage === link.href ? 'active' : '';
    navHTML += `<li><a href="${link.href}" class="${isActive}">${link.label}</a></li>`;
  });
  
  navHTML += '</ul></nav>';
  navbarContainer.innerHTML = navHTML;
}

document.addEventListener('DOMContentLoaded', initNavbar);
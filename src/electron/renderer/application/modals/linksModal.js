const $ = require('jquery');

module.exports = {
  name: 'linksModal',
  render: (application) => {
    // Create modal overlay
    const $modal = $('<div>', {
      class: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm',
      id: 'linksModal'
    });

    // Create modal content container
    const $content = $('<div>', {
      class: 'bg-primary-bg rounded-xl shadow-2xl max-w-xs w-full mx-4 overflow-hidden transform transition-all duration-200 scale-100 hover:scale-[1.01]'
    });

    // Modal header
    const $header = $('<div>', {
      class: 'px-6 py-4 bg-secondary-bg border-b border-sidebar-border flex items-center justify-between'
    });

    const $title = $('<h3>', {
      class: 'text-lg font-semibold text-text-primary flex items-center',
      html: '<i class="fas fa-link mr-2"></i> Quick Links'
    });

    const $closeButton = $('<button>', {
      class: 'text-gray-400 hover:text-highlight-red transition-colors duration-200 transform hover:scale-110 rounded-full p-1 hover:bg-highlight-red/10',
      'aria-label': 'Close'
    }).append(
      $('<i>', { class: 'fas fa-times' })
    ).on('click', () => application.modals.close()); // Use modal system close

    $header.append($title, $closeButton);

    // Modal body with links
    const $body = $('<div>', {
      class: 'p-6' // Add padding to the body
    });

    const $linksContainer = $('<div>', {
        class: 'flex justify-around items-center space-x-4' // Use justify-around for spacing
    });

    // Define links data
    const links = [
      { url: 'https://discord.gg/HzFe7XpuPs', label: 'Discord', icon: 'fab fa-discord', color: 'hover:text-indigo-400' },
      { url: 'https://github.com/glvckoma/strawberry-jam', label: 'GitHub', icon: 'fab fa-github', color: 'hover:text-highlight-green' },
      { url: 'https://jam.exposed', label: 'Masterpieces', icon: 'fas fa-palette', color: 'hover:text-peachy-beige' },
      { url: 'https://github.com/glvckoma/AJC-Price-Checker', label: 'AJC Price Checker', icon: 'fas fa-tags', color: 'hover:text-blue-400' }
    ];

    // Add links to the container
    links.forEach(link => {
      const $link = $('<a>', {
        href: '#',
        class: `text-sidebar-text ${link.color} p-3 rounded-lg hover:bg-tertiary-bg transition-colors flex flex-col items-center text-center`,
        onclick: `jam.application.open('${link.url}'); return false;`,
        'aria-label': link.label,
        'data-tooltip': link.label
      }).append(
        $('<i>', { class: `${link.icon} text-2xl mb-1` }), // Larger icon, margin bottom
        // $('<span>', { class: 'text-xs', text: link.label }) // Optional: Add text label below icon
      );
      $linksContainer.append($link);
    });

    $body.append($linksContainer);

    // Assemble modal
    $content.append($header, $body);
    $modal.append($content);

    // Fade in animation (optional but nice)
    $modal.css({
      'opacity': '0',
      'transform': 'scale(0.95)'
    });

    setTimeout(() => {
      $modal.css({
        'opacity': '1',
        'transform': 'scale(1)',
        'transition': 'opacity 0.2s ease-out, transform 0.2s ease-out'
      });
    }, 10);

    return $modal;
  }
}; 
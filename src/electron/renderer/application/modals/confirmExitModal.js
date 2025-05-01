/**
 * @file confirmExitModal.js - Modal for confirming application exit.
 */

const { ipcRenderer } = require('electron');

// Define isDevelopment for environment checks
const isDevelopment = process.env.NODE_ENV === 'development';

// Helper: Only log in development
function devLog(...args) {
  if (isDevelopment) console.log(...args);
}

module.exports = {
  name: 'confirmExitModal',

  /**
   * Renders the confirm exit modal.
   * @param {Application} application - The application instance.
   * @param {Object} data - Optional data (not used here).
   * @returns {JQuery<HTMLElement>} - The rendered modal element.
   */
  render (application, data = {}) {
    devLog('[ConfirmExitModal] Rendering modal...');

    // Create modal structure using jQuery
    const $modal = $('<div>', {
      class: 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm',
      id: 'confirmExitModalContainer' // Unique ID for the container
    });

    const $content = $('<div>', {
      class: 'bg-primary-bg rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden transform transition-all duration-200 scale-100'
    });

    // Header
    const $header = $('<div>', {
      class: 'px-6 py-4 bg-gradient-to-r from-red-500/20 to-red-500/5 border-b border-red-500/50 flex items-center justify-between'
    });
    const $title = $('<h3>', {
      class: 'text-lg font-bold text-error-red flex items-center',
      html: '<i class="fas fa-exclamation-triangle mr-2"></i> Confirm Exit'
    });
    // No close button in header for this modal

    $header.append($title);

    // Body
    const $body = $('<div>', {
      class: 'px-6 py-5'
    });

    $body.append(
      $('<p>', {
        class: 'text-text-primary text-base mb-4',
        text: 'Are you sure you want to exit Strawberry Jam?'
      }),
      $('<div>', { class: 'flex items-center mb-4' }).append(
        $('<input>', {
          type: 'checkbox',
          id: 'dontAskAgainCheckbox',
          class: 'mr-2 h-4 w-4 rounded border-gray-300 text-theme-primary focus:ring-theme-primary'
        }),
        $('<label>', {
          for: 'dontAskAgainCheckbox',
          class: 'text-sm text-text-secondary',
          text: "Don't ask me again"
        })
      )
    );

    // Footer with buttons
    const $footer = $('<div>', {
      class: 'px-6 py-4 bg-tertiary-bg border-t border-sidebar-border/50 flex justify-end items-center space-x-3'
    });

    const $cancelButton = $('<button>', {
      class: 'bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium',
      text: 'Cancel'
    }).on('click', () => {
      devLog('[ConfirmExitModal] Cancel clicked.');
      // Send response back to main process
      ipcRenderer.send('exit-confirmation-response', {
        confirmed: false,
        dontAskAgain: $('#dontAskAgainCheckbox').is(':checked') // Check state on click
      });
      application.modals.close(); // Close the modal
    });

    const $exitButton = $('<button>', {
      class: 'bg-error-red hover:bg-error-red/90 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-md hover:shadow-lg',
      text: 'Yes, Exit'
    }).on('click', () => {
      devLog('[ConfirmExitModal] Yes, Exit clicked.');
      // Send response back to main process
      ipcRenderer.send('exit-confirmation-response', {
        confirmed: true,
        dontAskAgain: $('#dontAskAgainCheckbox').is(':checked') // Check state on click
      });
      // No need to close modal here, app will quit
    });

    $footer.append($cancelButton, $exitButton);

    // Assemble and return
    $content.append($header, $body, $footer);
    $modal.append($content);

    // Add fade-in animation
    $modal.css({ opacity: 0 }).animate({ opacity: 1 }, 200);

    return $modal;
  },

  // Optional: Add a close handler if needed for specific cleanup
  close (application) {
    devLog('[ConfirmExitModal] Close handler called (optional).');
    // Perform any cleanup specific to this modal if necessary
  }
};

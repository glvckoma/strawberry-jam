module.exports = function ({ application, dispatch }) {
  /**
   * Handles in-game message commands.
   * @param param0
   */
  const handlePublicMessage = ({ message: event, game = true }) => {
    const [message] = event.value('txt').text().split('%')

    if (message.startsWith('!')) {
      event.send = false

      const parameters = message.split(' ').slice(1)
      const command = parameters.shift()

      if (!command) return

      const cmd = dispatch.commands.get(command)
      if (cmd) {
        try {
          cmd.callback({ parameters, game })
        } catch (error) {
          application.consoleMessage({
            type: 'error',
            message: `Failed executing the command ${command}. ${error.message}`
          })
        }
      }
    }
  }

  /**
   * Handles the clear command which clears console logs.
   */
  const handleClearCommand = ({ game = true }) => {
    // Clear console messages
    $('#messages').empty()
    
    // Reset the message count
    application._appMessageCount = 0
    
    // Show confirmation message
    application.consoleMessage({
      type: 'success',
      message: 'Console logs cleared successfully.'
    })
  }

  /**
   * Register the clear command.
   */
  dispatch.onCommand({
    name: 'clear',
    description: 'Clears all console logs.',
    callback: handleClearCommand
  })

  /**
   * Chat message hook.
   */
  dispatch.onMessage({
    type: 'connection',
    message: 'pubMsg',
    callback: handlePublicMessage
  })
}

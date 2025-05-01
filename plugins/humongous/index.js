module.exports = function ({ dispatch, application }) {
  let size = 13
  let active = false

  /**
   * Handles the humongous command.
   * @returns
   */
  const handleHumongousCommand = async ({ parameters }) => { // Added async
    active = !active

    const room = await dispatch.getState('room') // Added await
    if (!room) {
      return application.consoleMessage({
        message: 'You must be in a room to use this plugin.',
        type: 'error'
      })
    }

    if (active) {
      dispatch.serverMessage('You are now humongous! Re-join the room so other players can see you as a giant.')
    }

    size = parseInt(parameters[0]) || 13
  }

  /**
   * Handles movement updates.
   * @param {Object} param The parameter object.
   * @param {Object} param.message The message object.
   * @returns
   */
  const handleMovementUpdate = async ({ message }) => { // Added async
    if (!active) return

    const room = await dispatch.getState('room') // Added await

    const x = message.value[6]
    const y = message.value[7]

    message.send = false
    dispatch.sendRemoteMessage(`%xt%o%au%${room}%1%${x}%${y}%${size}%1%`)
  }

  /**
   * Handles movement updates.
   */
  dispatch.onMessage({
    type: 'connection',
    message: 'au',
    callback: handleMovementUpdate
  })

  /**
   * Handles humongous command.
   */
  dispatch.onCommand({
    name: 'humongous',
    description: 'Look down on all the other animals with this humongous size hack!',
    callback: handleHumongousCommand
  })
}

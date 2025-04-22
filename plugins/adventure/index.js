module.exports = function ({ dispatch, application }) {
  /**
   * Color interval.
   */
  let interval = null

  // Room tracking utilities are now exposed via preload script on window.jam.roomUtils
  // const roomUtils = require('../../src/utils/room-tracking') // Removed broken require

  /**
   * Handles adventure command.
   */
  const handleAdventureCommnd = () => {
    // Try to get room from multiple sources
    const roomFromState = window.jam?.state?.room
    const roomFromDispatch = dispatch.getState('room')
    const room = roomFromState || roomFromDispatch
    
    console.log('[Adventure] Room ID from jam.state:', roomFromState)
    console.log('[Adventure] Room ID from dispatch:', roomFromDispatch)
    console.log('[Adventure] Using room ID:', room)

    if (!room) {
      return application.consoleMessage({
        message: 'You must be in a room to use this plugin.',
        type: 'error'
      })
    }

    if (interval) return clear()
    interval = dispatch.setInterval(() => adventure(room), 600)
  }

  /**
   * Sends the treasure packet to the server.
   */
  const adventure = async (room) => {
    // Use the globally exposed utility function
    const roomId = window.jam.roomUtils.getEffectiveRoomId(room)
    console.log('[Adventure] Using effective room ID for packet:', roomId)
    await dispatch.sendRemoteMessage(`%xt%o%qat%${roomId}%treasure_1%0%`)
    dispatch.sendRemoteMessage(`%xt%o%qatt%${roomId}%treasure_1%1%`)
  }

  /**
   * Clears an interval.
   */
  const clear = () => {
    dispatch.clearInterval(interval)
    interval = null
  }

  /**
   * Chat message hook.
   */
  dispatch.onCommand({
    name: 'adventure',
    description: 'Loads chests and gives experience.',
    callback: handleAdventureCommnd
  })
}

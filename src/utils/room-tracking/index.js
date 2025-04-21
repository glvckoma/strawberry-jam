/**
 * Room Tracking Utilities
 * 
 * This module provides utility functions for tracking and managing room identifiers
 * in Animal Jam, handling both regular rooms and adventure rooms.
 */

/**
 * Determines if a room is an adventure room based on its identifier.
 * Adventure rooms have different formats than regular rooms.
 * 
 * @param {string} room - The room identifier from the game
 * @returns {boolean} - True if this is an adventure room
 */
const isAdventureRoom = (room) => {
  if (!room) return false
  
  return room.includes('quest_') || 
         room.includes('adventures.room_adventure') || 
         room.includes('room_adventure') ||
         room.match(/quest_\d+_\d+_\d+/)
}

/**
 * Extracts the appropriate room ID for use in packets.
 * - For adventure rooms: Uses the full room ID
 * - For regular rooms: Extracts just the numeric ID or base name
 * 
 * @param {string} room - The raw room identifier from the game
 * @returns {string} - The effective room ID for use in packets
 */
const getEffectiveRoomId = (room) => {
  if (!room) return null
  
  if (isAdventureRoom(room)) {
    // Adventure rooms need the full identifier
    return room
  } else {
    // Regular rooms usually have format like "coral_canyons.room_main#6"
    // Extract just the part before the # if it exists
    return room.includes('#') ? room.split('#')[0] : room
  }
}

/**
 * Processes packet content by replacing {room} placeholders with the appropriate room ID.
 * 
 * @param {string} content - The packet content with {room} placeholders
 * @param {string} room - The current room identifier
 * @returns {string} - The processed content with replaced room IDs
 */
const processRoomInPacket = (content, room) => {
  if (!content || !room) return content
  
  if (content.includes('{room}')) {
    const effectiveRoomId = getEffectiveRoomId(room)
    return content.replaceAll('{room}', effectiveRoomId)
  }
  
  return content
}

module.exports = {
  isAdventureRoom,
  getEffectiveRoomId,
  processRoomInPacket
}


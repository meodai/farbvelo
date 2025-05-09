// Functions for visualizing color positions found in images

/**
 * Creates an overlay element showing the positions of colors in an image
 * @param {Object} colorLocations - Object mapping color keys to arrays of positions
 * @param {Object} rgbToHexMap - Object mapping RGB keys to hex colors
 * @param {HTMLElement} container - Container element to add the overlay to
 * @param {Object} imageData - Object with width and height properties
 * @returns {HTMLElement} The created overlay element
 */
export function createColorPositionsOverlay(colorLocations, rgbToHexMap, container, imageData) {
  // Remove any existing overlay
  const existingOverlay = container.querySelector('.color-positions-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay container with the same dimensions as the image
  const overlay = document.createElement('div');
  overlay.className = 'color-positions-overlay';
  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '10';
  
  // Create markers for each color position
  Object.entries(colorLocations).forEach(([colorKey, positions]) => {
    const hexColor = rgbToHexMap ? rgbToHexMap[colorKey] : '#ffffff';
    
    positions.forEach(pos => {
      // Skip default positions (they're just placeholders when a color wasn't found)
      if (pos.isDefault) return;
      
      const marker = document.createElement('div');
      marker.className = 'color-position-marker';
      marker.style.position = 'absolute';
      marker.style.left = `${pos.x * 100}%`;
      marker.style.top = `${pos.y * 100}%`;
      marker.style.width = '8px';
      marker.style.height = '8px';
      marker.style.borderRadius = '50%';
      marker.style.backgroundColor = hexColor;
      marker.style.transform = 'translate(-50%, -50%)';
      marker.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.8), 0 0 0 3px rgba(0,0,0,0.3)';
      marker.style.opacity = (1 - pos.distance * 0.5).toString(); // Closer colors are more opaque
      
      // Add a pulsing animation for better visibility
      marker.style.animation = 'pulse 2s infinite';
      
      overlay.appendChild(marker);
    });
  });
  
  // Add the overlay to the container
  container.appendChild(overlay);
  
  // Add CSS animation to the document if not already present
  if (!document.getElementById('color-position-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'color-position-styles';
    styleEl.textContent = `
      @keyframes pulse {
        0% { transform: translate(-50%, -50%) scale(1); }
        50% { transform: translate(-50%, -50%) scale(1.5); }
        100% { transform: translate(-50%, -50%) scale(1); }
      }
    `;
    document.head.appendChild(styleEl);
  }
  
  return overlay;
}

/**
 * Visualizes the color positions in an image
 * @param {Object} colorLocations - Object mapping color keys to arrays of positions
 * @param {Array<string>} hexColors - Array of hex colors
 * @param {HTMLElement} imageContainer - Container element holding the image
 * @param {Object} imageData - Object with width and height properties
 */
export function visualizeColorPositions(colorLocations, hexColors, imageContainer, imageData) {
  if (!colorLocations || !hexColors || !imageContainer) {
    console.error('Missing required parameters for visualizeColorPositions');
    return;
  }
  
  // Create mapping from RGB keys to hex colors
  const rgbToHexMap = {};
  hexColors.forEach(hex => {
    const rgb = chroma(hex).rgb();
    const key = `${rgb[0]}-${rgb[1]}-${rgb[2]}`;
    rgbToHexMap[key] = hex;
  });
  
  createColorPositionsOverlay(colorLocations, rgbToHexMap, imageContainer, imageData);
}

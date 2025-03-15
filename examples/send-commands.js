/**
 * Example of sending commands to browser extensions via the Lamela API
 */

// WebSocket connection to the API server
const socket = new WebSocket("ws://localhost:8080");

// Wait for connection to open
socket.onopen = () => {
  console.log("Connected to Lamela API server");

  // Example 1: Navigate to a URL in all connected browsers
  sendCommand("goto", { url: "https://example.com" });

  // Example 2: Click an element in a specific browser
  // Replace '123456' with an actual browser access code
  sendCommand("click", { selector: "#submit-button" }, "123456");

  // Example 3: Extract text from elements
  sendCommand("getText", { selector: "h1" });

  // Example 4: Fill a form field
  sendCommand("type", { selector: "#username", text: "testuser" });

  // Example 5: Wait for an element to appear
  sendCommand("waitForSelector", { selector: ".results", timeout: 5000 });

  // Example 6: Execute custom JavaScript
  sendCommand("evaluate", {
    function: "function() { return document.title; }",
    arguments: "[]",
  });
};

// Handle messages from the server
socket.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log("Received message:", data);
  } catch (error) {
    console.log("Received non-JSON message:", event.data);
  }
};

// Handle connection close
socket.onclose = () => {
  console.log("Connection closed");
};

// Handle errors
socket.onerror = (error) => {
  console.error("WebSocket error:", error);
};

/**
 * Send a command to browser extensions
 * @param {string} command The command to send
 * @param {object} params Parameters for the command
 * @param {string} [specificBrowser] Optional browser access code to target a specific browser
 */
function sendCommand(command, params = {}, specificBrowser = null) {
  // Format the command string as expected by CommandHandler
  let commandString = `main:${command}`;

  // Add parameters
  for (const [key, value] of Object.entries(params)) {
    let formattedValue = value;

    // Format the value based on its type
    if (typeof value === "string") {
      // Escape quotes in strings
      formattedValue = value.replace(/"/g, '\\"');
    }

    commandString += ` ${key}=${formattedValue}`;
  }

  // Add specific browser if provided
  if (specificBrowser) {
    commandString += ` browser=${specificBrowser}`;
  }

  // Send the command
  socket.send(commandString);
  console.log("Sent command:", commandString);
}

// Example of sending a command with a callback for the result
function sendCommandWithCallback(
  command,
  params = {},
  specificBrowser = null,
  callback
) {
  // Generate a unique ID for this command
  const commandId = Date.now().toString();

  // Set up a one-time listener for the result
  const messageHandler = (event) => {
    try {
      const data = JSON.parse(event.data);

      // Check if this is a result for our command
      if (data.type === "COMMAND_RESULT" && data.data.commandId === commandId) {
        // Remove the listener
        socket.removeEventListener("message", messageHandler);

        // Call the callback with the result
        callback(data.data.success, data.data.result, data.data.error);
      }
    } catch (error) {
      // Ignore non-JSON messages
    }
  };

  // Add the listener
  socket.addEventListener("message", messageHandler);

  // Send the command
  sendCommand(command, { ...params, commandId }, specificBrowser);
}

// Example usage of sendCommandWithCallback
function getPageTitle(callback) {
  sendCommandWithCallback(
    "evaluate",
    {
      function: "function() { return document.title; }",
      arguments: "[]",
    },
    null, // Send to all browsers
    (success, result, error) => {
      if (success) {
        callback(result);
      } else {
        console.error("Error getting page title:", error);
      }
    }
  );
}

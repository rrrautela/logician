
// Select all the buttons with collapsble as their class
const collapsibles = document.querySelectorAll(".collapsible");

// Loop through each of them
collapsibles.forEach((btn) => {

  // Add a click event listner to each
  btn.addEventListener("click", () => {

    // Toggle the 'active' class to rotate the arrow indicator
    btn.classList.toggle("active");

    // Select the next sibling element, which is the collapsible content div
    const content = btn.nextElementSibling;

    // Check if the content is already expanded
    if (content.style.maxHeight) {
      // If expanded, collapse it by removing max-height
      content.style.maxHeight = null;
    } else {
      // If collapsed, expand it by setting max-height to scrollHeight
      // scrollHeight = full height of the content
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
});



const algoDisplay = document.getElementById("algoDisplay");

// Map buttons to the myframe src (pass algo as query param if needed)
const algoFiles = {
  "maze-solver-dfs": "maze.html?algo=DFS",
  "maze-solver-bfs": "maze.html?algo=BFS"
};

// Attach click listeners
Object.keys(algoFiles).forEach(id => {
  const btn = document.getElementById(id);
  btn.addEventListener("click", () => {
    // Create or update the myframe
    let myframe = algoDisplay.querySelector("iframe");
    if (!myframe) {
      myframe = document.createElement("iframe");
      myframe.style.width = "100%";
      myframe.style.height = "100%";
      myframe.style.border = "none";
      algoDisplay.appendChild(myframe);
    }

    // Set the src to load the proper maze
    myframe.src = algoFiles[id];
  });
});

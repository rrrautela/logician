const params = new URLSearchParams(window.location.search);
const algo = params.get("algo") || "DFS"; // get algo type from URL, default DFS
document.getElementById(
  "maze-title"
).textContent = `Maze Solver ${algo}: path from first cell to last cell`;

let mazeGrid = []; // 2D array representing the maze: 1=open, -1=wall, 2=visited

// DOM elements
const gridContainer = document.getElementById("maze-grid");
const inputSize = document.getElementById("grid-size");
const btnGenerate = document.getElementById("generate-grid");
const delayInput = document.getElementById("delay-time");
const btnStart = document.getElementById("start-solving");

function sleep(ms) {
  // Returns a promise that resolves after ms milliseconds
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateGrid(n) {
  gridContainer.innerHTML = ""; // clear previous grid
  mazeGrid = []; // reset 2D array

  // set CSS grid size
  gridContainer.style.gridTemplateColumns = `repeat(${n}, 2rem)`; //2 rem each box repeat n times
  gridContainer.style.gridTemplateRows = `repeat(${n}, 2rem)`;

  for (let r = 0; r < n; r++) {
    const rowArr = [];
    for (let c = 0; c < n; c++) {
      rowArr.push(1); // default cell = open

      const cell = document.createElement("div");
      cell.className = "grid-cell";
      cell.id = `cell_${r}_${c}`;
      gridContainer.appendChild(cell);

      // Click to toggle wall
      cell.addEventListener("click", () => {
        cell.style.backgroundColor = "red";
        mazeGrid[r][c] = -1;
      });
    }
    mazeGrid.push(rowArr); ///= maze grid is the 2d array where we actually apply dsa
  }
}

// Initial grid generation
generateGrid(Number(inputSize.value));


//event listeners
btnGenerate.addEventListener("click", () => {
  let n = Number(inputSize.value);
  if (n < 2) n = 2;
  if (n > 25) n = 25;
  inputSize.value = n;
  generateGrid(n);
});

btnStart.addEventListener("click", () => {
  const delay_time = Number(delayInput.value); // get current delay from input
  if (algo === "DFS") solveMazeDFS(delay_time);
  if (algo === "BFS") solveMazeBFS(delay_time);
});

// func for dfs
async function solveMazeDFS(delay_time) {
  const n = mazeGrid.length;
  const path = []; // store current path

  // Recursive DFS function
  async function dfs(r, c) {
    // bounds check
    if (r < 0 || c < 0 || r >= n || c >= n) return false;

    // wall or already visited
    if (mazeGrid[r][c] === -1 || mazeGrid[r][c] === 2) return false;

    mazeGrid[r][c] = 2; // mark visited
    path.push([r, c]);

    const cell = document.getElementById(`cell_${r}_${c}`);
    await sleep(delay_time);
    cell.style.backgroundColor = "green"; // visiting

    // check if target reached
    if (r === n - 1 && c === n - 1) {
      // mark correct path yellow
      for (const [pr, pc] of path) {
        const finalCell = document.getElementById(`cell_${pr}_${pc}`);
        await sleep(50);
        finalCell.style.backgroundColor = "yellow";
      }
      return true;
    }

    // 4 directions: up, right, down, left
    const dirs = [
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
    ];

    for (const [dr, dc] of dirs) {
      if (await dfs(r + dr, c + dc)) return true;
    }

    // backtrack
    await sleep(delay_time);
    cell.style.backgroundColor = "white";
    mazeGrid[r][c] = 1;
    path.pop();
    return false;
  }

  await dfs(0, 0);
}

//func for bfs
async function solveMazeBFS(delay_time) {
  const n = mazeGrid.length;
  const queue = [[0, 0]];
  const parent = Array.from({ length: n }, () => Array(n).fill(null));

  mazeGrid[0][0] = 2; // mark start as visited

  while (queue.length) {
    const levelSize = queue.length; // nodes in current level

    for (let i = 0; i < levelSize; i++) {
      const [r, c] = queue.shift();
      const cell = document.getElementById(`cell_${r}_${c}`);
      cell.style.backgroundColor = "green"; // color instantly

      // 4 directions
      const dirs = [
        [-1, 0],
        [0, 1],
        [1, 0],
        [0, -1],
      ];

      for (const [dr, dc] of dirs) {
        const nr = r + dr;
        const nc = c + dc;

        if (nr >= 0 && nc >= 0 && nr < n && nc < n && mazeGrid[nr][nc] === 1) {
          mazeGrid[nr][nc] = 2; // mark visited
          parent[nr][nc] = [r, c]; // track parent for path
          queue.push([nr, nc]);
        }
      }
    }

    await sleep(delay_time); // wait after finishing the level
  }

  // reconstruct path if reached
  if (mazeGrid[n - 1][n - 1] === 2) {
    let cur = [n - 1, n - 1];
    while (cur) {
      const [pr, pc] = cur;
      document.getElementById(`cell_${pr}_${pc}`).style.backgroundColor =
        "yellow";
      cur = parent[pr][pc];
      await sleep(50);
    }
  }
}

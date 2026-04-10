import { useEffect, useMemo, useRef, useState } from "react";
import { arrayAlgorithmMap, arrayAlgorithms } from "./algorithms/arrayIndex";
import { gridAlgorithmMap, gridAlgorithms } from "./algorithms/gridIndex";
import { ArrayPanel } from "./components/ArrayPanel";
import { Controls } from "./components/Controls";
import { Grid } from "./components/Grid";
import { Sidebar } from "./components/Sidebar";
import {
  ArrayVisualizationRunner,
  type ArrayRunnerSnapshot,
  type ArrayVisualState,
} from "./engine/arrayRunner";
import {
  VisualizationRunner,
  type RunnerSnapshot,
} from "./engine/runner";
import type { ArrayData } from "./types/array";
import type { Cell, GridConfig } from "./types/grid";
import {
  cloneArrayData,
  getArrayPresetsForAlgorithm,
  getDefaultArrayDataForAlgorithm,
  getRandomArrayDataForAlgorithm,
} from "./utils/array";
import {
  clearTraversalState,
  cloneGrid,
  generateRandomGrid,
  toggleWall,
} from "./utils/grid";

const GRID_CONFIG: GridConfig = {
  rows: 14,
  cols: 14,
  start: [0, 0],
  end: [13, 13],
};

const INITIAL_GRID = generateRandomGrid(GRID_CONFIG, 0.2);

const INITIAL_GRID_SNAPSHOT: RunnerSnapshot = {
  status: "idle",
  stepCount: 0,
  exploredCount: 0,
  pathLength: 0,
  metricLabel: "Path / Order",
  foundPath: null,
  message: "Generate or edit a grid, then start an algorithm.",
  algorithmId: null,
};

const INITIAL_ARRAY_DATA = getDefaultArrayDataForAlgorithm("two-pointer-pair-sum");

const INITIAL_ARRAY_STATE: ArrayVisualState = {
  nums: [...INITIAL_ARRAY_DATA.nums],
  target: INITIAL_ARRAY_DATA.target,
  left: null,
  right: null,
  currentSum: null,
  action: null,
  found: false,
  foundIndices: null,
  maxLength: 0,
  windowIndices: null,
  window: [],
  maxSum: null,
  currentIndex: null,
  subarrayIndices: null,
  bestSubarrayIndices: null,
  explanation: "Load an example or random input to begin.",
  decision: null,
  changedIndices: [],
};

const INITIAL_ARRAY_SNAPSHOT: ArrayRunnerSnapshot = {
  status: "idle",
  stepCount: 0,
  totalSteps: 0,
  exploredCount: 0,
  pathLength: 0,
  metricLabel: "Comparisons",
  foundPath: null,
  message: "Load an example array, then start the algorithm.",
  algorithmId: null,
  recentMessages: [],
};

export default function App() {
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState("dfs");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [speed, setSpeed] = useState(110);
  const [baseGrid, setBaseGrid] = useState<Cell[][]>(() => cloneGrid(INITIAL_GRID));
  const [displayGrid, setDisplayGrid] = useState<Cell[][]>(() =>
    clearTraversalState(cloneGrid(INITIAL_GRID)),
  );
  const [arrayData, setArrayData] = useState<ArrayData>(() => cloneArrayData(INITIAL_ARRAY_DATA));
  const [arrayState, setArrayState] = useState<ArrayVisualState>(INITIAL_ARRAY_STATE);
  const [gridSnapshot, setGridSnapshot] = useState<RunnerSnapshot>(INITIAL_GRID_SNAPSHOT);
  const [arraySnapshot, setArraySnapshot] = useState<ArrayRunnerSnapshot>(INITIAL_ARRAY_SNAPSHOT);
  const [selectedArrayPresetId, setSelectedArrayPresetId] = useState("default");
  const gridRunnerRef = useRef<VisualizationRunner | null>(null);
  const arrayRunnerRef = useRef<ArrayVisualizationRunner | null>(null);

  const selectedGridAlgorithm = useMemo(
    () => gridAlgorithmMap.get(selectedAlgorithmId) ?? null,
    [selectedAlgorithmId],
  );
  const selectedArrayAlgorithm = useMemo(
    () => arrayAlgorithmMap.get(selectedAlgorithmId) ?? null,
    [selectedAlgorithmId],
  );
  const selectedEngine = selectedArrayAlgorithm ? "array" : "grid";
  const activeGridAlgorithm = selectedGridAlgorithm ?? gridAlgorithms[0];
  const activeArrayAlgorithm = selectedArrayAlgorithm ?? arrayAlgorithms[0];
  const activeSnapshot = selectedEngine === "array" ? arraySnapshot : gridSnapshot;
  const arrayPresets = useMemo(
    () => getArrayPresetsForAlgorithm(activeArrayAlgorithm.id),
    [activeArrayAlgorithm.id],
  );

  if (!gridRunnerRef.current) {
    gridRunnerRef.current = new VisualizationRunner({
      onGridUpdate: setDisplayGrid,
      onSnapshotUpdate: setGridSnapshot,
    });
  }

  if (!arrayRunnerRef.current) {
    arrayRunnerRef.current = new ArrayVisualizationRunner({
      onArrayStateUpdate: setArrayState,
      onSnapshotUpdate: setArraySnapshot,
    });
  }

  useEffect(() => {
    if (!gridAlgorithmMap.has(selectedAlgorithmId) && !arrayAlgorithmMap.has(selectedAlgorithmId)) {
      setSelectedAlgorithmId("dfs");
    }
  }, [selectedAlgorithmId]);

  useEffect(() => {
    if (!selectedGridAlgorithm) {
      return;
    }
    gridRunnerRef.current!.configure(baseGrid, selectedGridAlgorithm);
  }, [baseGrid, selectedGridAlgorithm]);

  useEffect(() => {
    if (!selectedArrayAlgorithm) {
      return;
    }

    setSelectedArrayPresetId("default");
    setArrayData(getDefaultArrayDataForAlgorithm(selectedArrayAlgorithm.id));
  }, [selectedArrayAlgorithm]);

  useEffect(() => {
    if (!selectedArrayAlgorithm) {
      return;
    }
    arrayRunnerRef.current!.configure(arrayData, selectedArrayAlgorithm);
  }, [arrayData, selectedArrayAlgorithm]);

  useEffect(() => {
    gridRunnerRef.current?.setSpeed(speed);
    arrayRunnerRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    return () => {
      gridRunnerRef.current?.dispose();
      arrayRunnerRef.current?.dispose();
    };
  }, []);

  function handleGenerate() {
    if (selectedEngine === "array") {
      setSelectedArrayPresetId("default");
      setArrayData(getDefaultArrayDataForAlgorithm(activeArrayAlgorithm.id));
      return;
    }

    setBaseGrid(generateRandomGrid(GRID_CONFIG, 0.24));
  }

  function handleEditCell(row: number, col: number) {
    if (activeSnapshot.status === "running") {
      return;
    }

    setBaseGrid((currentGrid) => toggleWall(currentGrid, row, col));
  }

  function handleReset() {
    if (selectedEngine === "array") {
      arrayRunnerRef.current?.reset(arrayData);
      return;
    }

    gridRunnerRef.current?.reset(baseGrid);
  }

  function handleTogglePlayback() {
    if (activeSnapshot.status === "running") {
      if (selectedEngine === "array") {
        arrayRunnerRef.current?.pause();
      } else {
        gridRunnerRef.current?.pause();
      }
      return;
    }

    if (selectedEngine === "array") {
      arrayRunnerRef.current?.start();
    } else {
      gridRunnerRef.current?.start();
    }
  }

  function handleNextStep() {
    if (selectedEngine === "array") {
      arrayRunnerRef.current?.stepForward();
    } else {
      gridRunnerRef.current?.stepForward();
    }
  }

  function handlePreviousStep() {
    if (selectedEngine === "array") {
      arrayRunnerRef.current?.stepBackward();
    } else {
      gridRunnerRef.current?.stepBackward();
    }
  }

  function handleSpeedChange(nextSpeed: number) {
    setSpeed(nextSpeed);
    gridRunnerRef.current?.setSpeed(nextSpeed);
    arrayRunnerRef.current?.setSpeed(nextSpeed);
  }

  function handleGenerateRandomArrayInput() {
    setSelectedArrayPresetId("random");
    setArrayData(getRandomArrayDataForAlgorithm(activeArrayAlgorithm.id));
  }

  function handleSelectArrayPreset(presetId: string) {
    const preset = arrayPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setSelectedArrayPresetId(presetId);
    setArrayData(cloneArrayData(preset.data));
  }

  return (
    <div className="app-shell">
      <Sidebar
        gridAlgorithms={gridAlgorithms}
        arrayAlgorithms={arrayAlgorithms}
        selectedId={selectedAlgorithmId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onSelectAlgorithm={setSelectedAlgorithmId}
      />

      <main className="workspace">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">Production-grade learning surface</p>
            <h1>Logician</h1>
          </div>
          <p className="hero-panel__copy">
            A focused React visualizer for DFS, BFS, and core array interview patterns.
          </p>
        </section>

        <section className="workspace__content">
          {selectedEngine === "array" ? (
            <ArrayPanel arrayState={arrayState} />
          ) : (
            <Grid grid={displayGrid} onEditCell={handleEditCell} />
          )}
          <Controls
            algorithm={selectedEngine === "array" ? activeArrayAlgorithm : activeGridAlgorithm}
            snapshot={activeSnapshot}
            speed={speed}
            onGenerate={handleGenerate}
            onTogglePlayback={handleTogglePlayback}
            onReset={handleReset}
            onPreviousStep={handlePreviousStep}
            onNextStep={handleNextStep}
            onSpeedChange={handleSpeedChange}
            onGenerateRandom={selectedEngine === "array" ? handleGenerateRandomArrayInput : undefined}
            presets={selectedEngine === "array" ? arrayPresets : undefined}
            selectedPresetId={selectedEngine === "array" ? selectedArrayPresetId : undefined}
            onSelectPreset={selectedEngine === "array" ? handleSelectArrayPreset : undefined}
          />
        </section>
      </main>
    </div>
  );
}

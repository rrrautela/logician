import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { arrayAlgorithmMap, arrayAlgorithms } from "./algorithms/arrayIndex";
import { graphAlgorithmMap, graphAlgorithms } from "./algorithms/graphIndex";
import { gridAlgorithmMap, gridAlgorithms } from "./algorithms/gridIndex";
import { ArrayPanel } from "./components/ArrayPanel";
import { Controls } from "./components/Controls";
import { GraphPanel } from "./components/GraphPanel";
import { Grid } from "./components/Grid";
import { Sidebar } from "./components/Sidebar";
import {
  ArrayVisualizationRunner,
  arrayStateEngine,
  type ArrayRunnerSnapshot,
} from "./engine/arrayRunner";
import {
  GraphVisualizationRunner,
  graphStateEngine,
  type GraphRunnerSnapshot,
} from "./engine/graphRunner";
import { VisualizationRunner, type RunnerSnapshot } from "./engine/runner";
import type { ArrayData, ArrayVisualState } from "./types/array";
import type { Graph, GraphVisualState } from "./types/graph";
import type { SimulationSnapshot, StepEvent } from "./types/simulation";
import type { Cell, GridConfig } from "./types/grid";
import {
  cloneArrayData,
  getArrayPresetsForAlgorithm,
  getDefaultArrayDataForAlgorithm,
  getRandomArrayDataForAlgorithm,
} from "./utils/array";
import { createDemoGraph, cloneGraph } from "./utils/graph";
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
const INITIAL_ARRAY_DATA = getDefaultArrayDataForAlgorithm("two-pointer-pair-sum");
const INITIAL_GRAPH = createDemoGraph();

interface PendingPrediction {
  step: StepEvent;
  stepIndex: number;
  selectedOption: string | null;
  submitted: boolean;
}

const INITIAL_GRID_SNAPSHOT: RunnerSnapshot = {
  status: "idle",
  stepCount: 0,
  totalSteps: 0,
  exploredCount: 0,
  metricValue: 0,
  metricLabel: "Path Length",
  foundResult: null,
  message: "Generate or edit a grid, then start an algorithm.",
  algorithmId: null,
  explanation: undefined,
  decision: undefined,
  insightTags: [],
  recentMessages: [],
  recentEvents: [],
  milestoneSteps: [],
  performance: {
    totalSteps: 0,
    checkpointCount: 0,
    avgDiffBuildMs: 0,
    avgApplyDiffMs: 0,
    avgReplayMs: 0,
    estimatedTimelineBytes: 0,
    estimatedCheckpointBytes: 0,
    estimatedBaselineSnapshotBytes: 0,
  },
};

const INITIAL_ARRAY_SNAPSHOT: ArrayRunnerSnapshot = {
  status: "idle",
  stepCount: 0,
  totalSteps: 0,
  exploredCount: 0,
  metricValue: 0,
  metricLabel: "Comparisons",
  foundResult: null,
  message: "Load an example array, then start the algorithm.",
  algorithmId: null,
  explanation: undefined,
  decision: undefined,
  insightTags: [],
  recentMessages: [],
  recentEvents: [],
  milestoneSteps: [],
  performance: {
    totalSteps: 0,
    checkpointCount: 0,
    avgDiffBuildMs: 0,
    avgApplyDiffMs: 0,
    avgReplayMs: 0,
    estimatedTimelineBytes: 0,
    estimatedCheckpointBytes: 0,
    estimatedBaselineSnapshotBytes: 0,
  },
};

const INITIAL_GRAPH_SNAPSHOT: GraphRunnerSnapshot = {
  status: "idle",
  stepCount: 0,
  totalSteps: 0,
  exploredCount: 0,
  metricValue: 0,
  metricLabel: "Shortest Distance",
  foundResult: null,
  message: "Load an example graph, then start an algorithm.",
  algorithmId: null,
  explanation: undefined,
  decision: undefined,
  insightTags: [],
  recentMessages: [],
  recentEvents: [],
  milestoneSteps: [],
  performance: {
    totalSteps: 0,
    checkpointCount: 0,
    avgDiffBuildMs: 0,
    avgApplyDiffMs: 0,
    avgReplayMs: 0,
    estimatedTimelineBytes: 0,
    estimatedCheckpointBytes: 0,
    estimatedBaselineSnapshotBytes: 0,
  },
};

export default function App() {
  const [selectedAlgorithmId, setSelectedAlgorithmId] = useState("dfs");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [speed, setSpeed] = useState(400);
  const [baseGrid, setBaseGrid] = useState<Cell[][]>(() => cloneGrid(INITIAL_GRID));
  const [displayGrid, setDisplayGrid] = useState<Cell[][]>(() =>
    clearTraversalState(cloneGrid(INITIAL_GRID)),
  );
  const [baseGraph, setBaseGraph] = useState<Graph>(() => cloneGraph(INITIAL_GRAPH));
  const [graphState, setGraphState] = useState<GraphVisualState>(() =>
    graphStateEngine.createInitialState(cloneGraph(INITIAL_GRAPH)),
  );
  const [arrayData, setArrayData] = useState<ArrayData>(() => cloneArrayData(INITIAL_ARRAY_DATA));
  const [arrayState, setArrayState] = useState<ArrayVisualState>(() =>
    arrayStateEngine.createInitialState(cloneArrayData(INITIAL_ARRAY_DATA)),
  );
  const [gridSnapshot, setGridSnapshot] = useState<RunnerSnapshot>(INITIAL_GRID_SNAPSHOT);
  const [arraySnapshot, setArraySnapshot] = useState<ArrayRunnerSnapshot>(INITIAL_ARRAY_SNAPSHOT);
  const [graphSnapshot, setGraphSnapshot] = useState<GraphRunnerSnapshot>(INITIAL_GRAPH_SNAPSHOT);
  const [selectedArrayPresetId, setSelectedArrayPresetId] = useState("default");
  const [predictMode, setPredictMode] = useState(false);
  const [pendingPrediction, setPendingPrediction] = useState<PendingPrediction | null>(null);

  const gridRunnerRef = useRef<VisualizationRunner | null>(null);
  const arrayRunnerRef = useRef<ArrayVisualizationRunner | null>(null);
  const graphRunnerRef = useRef<GraphVisualizationRunner | null>(null);

  const selectedGridAlgorithm = useMemo(
    () => gridAlgorithmMap.get(selectedAlgorithmId) ?? null,
    [selectedAlgorithmId],
  );
  const selectedArrayAlgorithm = useMemo(
    () => arrayAlgorithmMap.get(selectedAlgorithmId) ?? null,
    [selectedAlgorithmId],
  );
  const selectedGraphAlgorithm = useMemo(
    () => graphAlgorithmMap.get(selectedAlgorithmId) ?? null,
    [selectedAlgorithmId],
  );

  const selectedEngine = selectedArrayAlgorithm
    ? "array"
    : selectedGraphAlgorithm
      ? "graph"
      : "grid";
  const activeGridAlgorithm = selectedGridAlgorithm ?? gridAlgorithms[0];
  const activeArrayAlgorithm = selectedArrayAlgorithm ?? arrayAlgorithms[0];
  const activeGraphAlgorithm = selectedGraphAlgorithm ?? graphAlgorithms[0];
  const activeSnapshot: SimulationSnapshot =
    selectedEngine === "array"
      ? arraySnapshot
      : selectedEngine === "graph"
        ? graphSnapshot
        : gridSnapshot;
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

  if (!graphRunnerRef.current) {
    graphRunnerRef.current = new GraphVisualizationRunner({
      onGraphStateUpdate: setGraphState,
      onSnapshotUpdate: setGraphSnapshot,
    });
  }

  useEffect(() => {
    if (
      !gridAlgorithmMap.has(selectedAlgorithmId) &&
      !arrayAlgorithmMap.has(selectedAlgorithmId) &&
      !graphAlgorithmMap.has(selectedAlgorithmId)
    ) {
      setSelectedAlgorithmId("dfs");
    }
  }, [selectedAlgorithmId]);

  useEffect(() => {
    if (selectedEngine !== "grid") {
      return;
    }

    gridRunnerRef.current?.load(baseGrid, activeGridAlgorithm);
  }, [selectedEngine, baseGrid, activeGridAlgorithm]);

  useEffect(() => {
    if (!selectedArrayAlgorithm) {
      return;
    }

    setSelectedArrayPresetId("default");
    setArrayData(getDefaultArrayDataForAlgorithm(selectedArrayAlgorithm.id));
  }, [selectedArrayAlgorithm]);

  useEffect(() => {
    if (selectedEngine !== "array") {
      return;
    }

    arrayRunnerRef.current?.load(arrayData, activeArrayAlgorithm);
  }, [selectedEngine, arrayData, activeArrayAlgorithm]);

  useEffect(() => {
    if (selectedEngine !== "graph") {
      return;
    }

    graphRunnerRef.current?.load(baseGraph, activeGraphAlgorithm);
  }, [selectedEngine, baseGraph, activeGraphAlgorithm]);

  useEffect(() => {
    gridRunnerRef.current?.setSpeed(speed);
    arrayRunnerRef.current?.setSpeed(speed);
    graphRunnerRef.current?.setSpeed(speed);
  }, [speed]);

  useEffect(() => {
    return () => {
      gridRunnerRef.current?.dispose();
      arrayRunnerRef.current?.dispose();
      graphRunnerRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    setPendingPrediction(null);
  }, [selectedAlgorithmId, selectedEngine]);

  function peekNextStep(): StepEvent | null {
    if (selectedEngine === "array") {
      return arrayRunnerRef.current?.peekNextStep() ?? null;
    }

    if (selectedEngine === "graph") {
      return graphRunnerRef.current?.peekNextStep() ?? null;
    }

    return gridRunnerRef.current?.peekNextStep() ?? null;
  }

  function stepActiveRunnerForward() {
    if (selectedEngine === "array") {
      arrayRunnerRef.current?.stepForward();
    } else if (selectedEngine === "graph") {
      graphRunnerRef.current?.stepForward();
    } else {
      gridRunnerRef.current?.stepForward();
    }
  }

  function handleGenerate() {
    setPendingPrediction(null);
    if (selectedEngine === "array") {
      setSelectedArrayPresetId("default");
      setArrayData(getDefaultArrayDataForAlgorithm(activeArrayAlgorithm.id));
      return;
    }

    if (selectedEngine === "graph") {
      setBaseGraph(createDemoGraph());
      return;
    }

    setBaseGrid(generateRandomGrid(GRID_CONFIG, 0.24));
  }

  function handleEditCell(row: number, col: number) {
    if (selectedEngine !== "grid" || activeSnapshot.status === "running") {
      return;
    }

    setBaseGrid((currentGrid) => toggleWall(currentGrid, row, col));
  }

  function handleReset() {
    setPendingPrediction(null);
    if (selectedEngine === "array") {
      arrayRunnerRef.current?.reset();
      return;
    }

    if (selectedEngine === "graph") {
      graphRunnerRef.current?.reset();
      return;
    }

    gridRunnerRef.current?.reset();
  }

  function handleTogglePlayback() {
    if (predictMode && activeSnapshot.status !== "running") {
      handleNextStep();
      return;
    }

    if (activeSnapshot.status === "running") {
      if (selectedEngine === "array") {
        arrayRunnerRef.current?.pause();
      } else if (selectedEngine === "graph") {
        graphRunnerRef.current?.pause();
      } else {
        gridRunnerRef.current?.pause();
      }
      return;
    }

    if (selectedEngine === "array") {
      arrayRunnerRef.current?.start();
    } else if (selectedEngine === "graph") {
      graphRunnerRef.current?.start();
    } else {
      gridRunnerRef.current?.start();
    }
  }

  function handleNextStep() {
    if (predictMode) {
      if (pendingPrediction) {
        return;
      }

      const nextStep = peekNextStep();
      if (nextStep) {
        setPendingPrediction({
          step: nextStep,
          stepIndex: activeSnapshot.stepCount + 1,
          selectedOption: null,
          submitted: false,
        });
        return;
      }
    }

    stepActiveRunnerForward();
  }

  function handlePreviousStep() {
    setPendingPrediction(null);
    if (selectedEngine === "array") {
      arrayRunnerRef.current?.stepBackward();
    } else if (selectedEngine === "graph") {
      graphRunnerRef.current?.stepBackward();
    } else {
      gridRunnerRef.current?.stepBackward();
    }
  }

  function handleSpeedChange(nextSpeed: number) {
    setSpeed(nextSpeed);
  }

  function handleSeek(step: number) {
    setPendingPrediction(null);
    flushSync(() => {
      if (selectedEngine === "array") {
        arrayRunnerRef.current?.seekToStep(step);
      } else if (selectedEngine === "graph") {
        graphRunnerRef.current?.seekToStep(step);
      } else {
        gridRunnerRef.current?.seekToStep(step);
      }
    });
  }

  function handleGenerateRandomArrayInput() {
    setPendingPrediction(null);
    setSelectedArrayPresetId("random");
    setArrayData(getRandomArrayDataForAlgorithm(activeArrayAlgorithm.id));
  }

  function handleSelectArrayPreset(presetId: string) {
    setPendingPrediction(null);
    const preset = arrayPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setSelectedArrayPresetId(presetId);
    setArrayData(cloneArrayData(preset.data));
  }

  function handleTogglePredictMode() {
    setPredictMode((value) => !value);
    setPendingPrediction(null);
  }

  function handleSelectPrediction(option: string) {
    setPendingPrediction((current) =>
      current ? { ...current, selectedOption: option } : current,
    );
  }

  function handleSubmitPrediction() {
    setPendingPrediction((current) =>
      current ? { ...current, submitted: true } : current,
    );
  }

  function handleRevealPrediction() {
    if (!pendingPrediction) {
      return;
    }

    stepActiveRunnerForward();
    setPendingPrediction(null);
  }

  const activeAlgorithm =
    selectedEngine === "array"
      ? activeArrayAlgorithm
      : selectedEngine === "graph"
        ? activeGraphAlgorithm
        : activeGridAlgorithm;

  const algorithmInfo = useMemo(
    () => ({
      timeComplexity: activeAlgorithm.metadata.timeComplexity ?? null,
      spaceComplexity: activeAlgorithm.metadata.spaceComplexity ?? null,
      keyIdea: activeAlgorithm.metadata.keyIdea ?? activeAlgorithm.metadata.behaviorNote ?? null,
    }),
    [activeAlgorithm],
  );

  const generateLabel =
    selectedEngine === "array"
      ? "Load Example Array"
      : selectedEngine === "graph"
        ? "Load Example Graph"
        : "Generate Random Grid";

  return (
    <div className="app-shell">
      <Sidebar
        gridAlgorithms={gridAlgorithms}
        arrayAlgorithms={arrayAlgorithms}
        graphAlgorithms={graphAlgorithms}
        selectedId={selectedAlgorithmId}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
        onSelectAlgorithm={setSelectedAlgorithmId}
      />

      <main className="workspace workspace--cinematic">
        <div className="visualization-viewport">
          {selectedEngine === "array" ? (
            <ArrayPanel arrayState={arrayState} />
          ) : selectedEngine === "graph" ? (
            <GraphPanel graphState={graphState} />
          ) : (
            <Grid grid={displayGrid} onEditCell={handleEditCell} />
          )}
          <div className="caption-overlay" role="status" aria-live="polite">
            <p className="caption-overlay__line" key={`${activeSnapshot.algorithmId}-${activeSnapshot.stepCount}`}>
              {activeSnapshot.message}
            </p>
          </div>
        </div>
        <Controls
          algorithm={activeAlgorithm}
          snapshot={activeSnapshot}
          speed={speed}
          generateLabel={generateLabel}
          onGenerate={handleGenerate}
          onTogglePlayback={handleTogglePlayback}
          onReset={handleReset}
          onPreviousStep={handlePreviousStep}
          onNextStep={handleNextStep}
          onSeek={handleSeek}
          onSpeedChange={handleSpeedChange}
          onGenerateRandom={selectedEngine === "array" ? handleGenerateRandomArrayInput : undefined}
          presets={selectedEngine === "array" ? arrayPresets : undefined}
          selectedPresetId={selectedEngine === "array" ? selectedArrayPresetId : undefined}
          onSelectPreset={selectedEngine === "array" ? handleSelectArrayPreset : undefined}
          milestoneSteps={activeSnapshot.milestoneSteps}
          algorithmInfo={algorithmInfo}
          predictMode={predictMode}
          pendingPrediction={pendingPrediction}
          onTogglePredictMode={handleTogglePredictMode}
          onSelectPrediction={handleSelectPrediction}
          onSubmitPrediction={handleSubmitPrediction}
          onRevealPrediction={handleRevealPrediction}
        />
      </main>
    </div>
  );
}

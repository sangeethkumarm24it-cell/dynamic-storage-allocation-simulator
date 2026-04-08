/* =========================================
   MemAlloc Simulator — Core Logic
   ========================================= */

// ── State ──────────────────────────────────────────────────────────────
let simResults = null;

// Colour pools for process assignment
const PROC_COLORS = [
  ['#6366f1','#4f46e5'], ['#06b6d4','#0891b2'], ['#10b981','#059669'],
  ['#f59e0b','#d97706'], ['#ec4899','#db2777'], ['#8b5cf6','#7c3aed'],
  ['#14b8a6','#0d9488'], ['#f97316','#ea580c'], ['#3b82f6','#2563eb'],
  ['#a855f7','#9333ea'], ['#22c55e','#16a34a'], ['#e11d48','#be123c'],
];

// ── Presets ─────────────────────────────────────────────────────────────
const PRESETS = {
  classic: {
    blocks: [100, 500, 200, 300, 600, 150],
    processes: [212, 417, 112, 426, 78]
  },
  tight: {
    blocks: [50, 80, 120, 60, 90],
    processes: [45, 75, 115, 55, 85, 100]
  },
  overflow: {
    blocks: [200, 150, 100],
    processes: [50, 180, 90, 60, 250, 110, 40]
  },
  exact: {
    blocks: [100, 200, 300, 150, 250],
    processes: [100, 200, 300, 150, 250]
  }
};

// ── Init ─────────────────────────────────────────────────────────────────
window.onload = () => {
  generateBlockInputs();
  generateProcessInputs();
};

// ── Generate dynamic inputs ──────────────────────────────────────────────
function generateBlockInputs() {
  const n = parseInt(document.getElementById('num-blocks').value) || 6;
  const container = document.getElementById('block-sizes-container');
  container.innerHTML = '';
  // Try to preserve existing values
  const vals = Array.from({length: n}, (_, i) => {
    const prev = document.querySelector(`#block-${i+1}`);
    return prev ? prev.value : '';
  });
  for (let i = 0; i < n; i++) {
    const div = document.createElement('div');
    div.className = 'dynamic-field';
    div.innerHTML = `
      <label for="block-${i+1}">Block ${i+1}</label>
      <input type="number" id="block-${i+1}" min="1" placeholder="Size" value="${vals[i]}" />
    `;
    container.appendChild(div);
  }
}

function generateProcessInputs() {
  const n = parseInt(document.getElementById('num-processes').value) || 5;
  const container = document.getElementById('process-sizes-container');
  container.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const div = document.createElement('div');
    div.className = 'dynamic-field';
    div.innerHTML = `
      <label for="proc-${i+1}">P${i+1}</label>
      <input type="number" id="proc-${i+1}" min="1" placeholder="Size" value="" />
    `;
    container.appendChild(div);
  }
}

// ── Presets ──────────────────────────────────────────────────────────────
function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;

  document.getElementById('num-blocks').value = p.blocks.length;
  generateBlockInputs();
  p.blocks.forEach((v, i) => {
    const el = document.getElementById(`block-${i+1}`);
    if (el) el.value = v;
  });

  document.getElementById('num-processes').value = p.processes.length;
  generateProcessInputs();
  p.processes.forEach((v, i) => {
    const el = document.getElementById(`proc-${i+1}`);
    if (el) el.value = v;
  });
}

// ── Collect inputs ────────────────────────────────────────────────────────
function collectInputs() {
  const nb = parseInt(document.getElementById('num-blocks').value) || 0;
  const np = parseInt(document.getElementById('num-processes').value) || 0;

  const blocks = [];
  const processes = [];
  let valid = true;

  for (let i = 1; i <= nb; i++) {
    const val = parseInt(document.getElementById(`block-${i}`)?.value);
    if (!val || val <= 0) { valid = false; break; }
    blocks.push(val);
  }

  for (let i = 1; i <= np; i++) {
    const val = parseInt(document.getElementById(`proc-${i}`)?.value);
    if (!val || val <= 0) { valid = false; break; }
    processes.push(val);
  }

  return { blocks, processes, valid: valid && blocks.length > 0 && processes.length > 0 };
}

// ── Allocation Algorithms ─────────────────────────────────────────────────

/**
 * First Fit: Allocate process to the FIRST block that fits.
 */
function firstFit(blocks, processes) {
  const mem = [...blocks];
  const alloc = new Array(processes.length).fill(-1);

  for (let p = 0; p < processes.length; p++) {
    for (let b = 0; b < mem.length; b++) {
      if (mem[b] >= processes[p]) {
        alloc[p] = b;
        mem[b] -= processes[p];
        break;
      }
    }
  }
  return buildResult(blocks, processes, mem, alloc);
}

/**
 * Best Fit: Allocate process to the SMALLEST sufficient block.
 */
function bestFit(blocks, processes) {
  const mem = [...blocks];
  const alloc = new Array(processes.length).fill(-1);

  for (let p = 0; p < processes.length; p++) {
    let bestIdx = -1;
    for (let b = 0; b < mem.length; b++) {
      if (mem[b] >= processes[p]) {
        if (bestIdx === -1 || mem[b] < mem[bestIdx]) {
          bestIdx = b;
        }
      }
    }
    if (bestIdx !== -1) {
      alloc[p] = bestIdx;
      mem[bestIdx] -= processes[p];
    }
  }
  return buildResult(blocks, processes, mem, alloc);
}

/**
 * Worst Fit: Allocate process to the LARGEST available block.
 */
function worstFit(blocks, processes) {
  const mem = [...blocks];
  const alloc = new Array(processes.length).fill(-1);

  for (let p = 0; p < processes.length; p++) {
    let worstIdx = -1;
    for (let b = 0; b < mem.length; b++) {
      if (mem[b] >= processes[p]) {
        if (worstIdx === -1 || mem[b] > mem[worstIdx]) {
          worstIdx = b;
        }
      }
    }
    if (worstIdx !== -1) {
      alloc[p] = worstIdx;
      mem[worstIdx] -= processes[p];
    }
  }
  return buildResult(blocks, processes, mem, alloc);
}

// ── Build result object ──────────────────────────────────────────────────
function buildResult(blocks, processes, remaining, alloc) {
  let internalFrag = 0;
  let externalFrag = 0;

  // Internal fragmentation: leftover inside allocated blocks due to this run
  // We only count fragmentation for blocks that WERE used
  const blockUsedBy = new Array(blocks.length).fill(-1);
  alloc.forEach((b, p) => { if (b !== -1) blockUsedBy[b] = p; });

  // Internal frag = remaining space in blocks that have a process in them
  // (unused space inside an allocated partition)
  for (let b = 0; b < blocks.length; b++) {
    if (blockUsedBy[b] !== -1) {
      internalFrag += remaining[b];
    }
  }

  // External frag = total free memory in UN-allocated blocks
  // that still cannot satisfy any remaining (unallocated) process
  const unallocatedProcesses = processes.filter((_, p) => alloc[p] === -1);
  const freeBlocks = blocks.map((_, b) => remaining[b]).filter((r, b) => blockUsedBy[b] === -1);

  // External fragmentation = free memory in blocks that cannot be used
  // i.e., free memory in blocks smaller than ANY remaining process
  for (const freeSize of freeBlocks) {
    const canFit = unallocatedProcesses.some(ps => ps <= freeSize);
    if (!canFit) {
      externalFrag += freeSize;
    }
  }

  const allocatedCount = alloc.filter(b => b !== -1).length;
  const failedCount = alloc.filter(b => b === -1).length;

  return {
    blocks,
    processes,
    remaining,
    alloc,
    internalFrag,
    externalFrag,
    allocatedCount,
    failedCount,
    totalProcessMemory: processes.reduce((a, b) => a + b, 0),
    totalBlockMemory: blocks.reduce((a, b) => a + b, 0),
  };
}

// ── Run Simulation ─────────────────────────────────────────────────────────
function runSimulation() {
  const { blocks, processes, valid } = collectInputs();
  if (!valid) {
    showToast('⚠️  Please fill in all block and process sizes correctly.');
    return;
  }

  simResults = {
    ff: firstFit(blocks, processes),
    bf: bestFit(blocks, processes),
    wf: worstFit(blocks, processes),
    blocks,
    processes,
  };

  renderResults(simResults);
  document.getElementById('results-section').style.display = 'block';
  document.getElementById('results-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Render Results ───────────────────────────────────────────────────────
function renderResults(data) {
  renderSummaryCards(data);
  renderAlgoPanel('first-fit', 'panel-first-fit', data.ff, PROC_COLORS, 'ff');
  renderAlgoPanel('best-fit',  'panel-best-fit',  data.bf, PROC_COLORS, 'bf');
  renderAlgoPanel('worst-fit', 'panel-worst-fit', data.wf, PROC_COLORS, 'wf');
  renderComparisonTable(data);
  // reset tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-algo="first-fit"]').classList.add('active');
  document.querySelectorAll('.algo-panel').forEach(p => p.style.display = 'none');
  document.getElementById('panel-first-fit').style.display = 'block';
}

// ── Summary Cards ────────────────────────────────────────────────────────
function renderSummaryCards(data) {
  const { blocks, processes, ff } = data;
  const totalMem = blocks.reduce((a, b) => a + b, 0);
  const totalProc = processes.reduce((a, b) => a + b, 0);
  const maxAlloc = Math.max(ff.allocatedCount, data.bf.allocatedCount, data.wf.allocatedCount);

  const cards = [
    { label: 'Total Memory', value: totalMem, sub: `${blocks.length} blocks`, color: '#6366f1' },
    { label: 'Total Processes', value: processes.length, sub: `${totalProc} units requested`, color: '#06b6d4' },
    { label: 'Best Allocation', value: maxAlloc, sub: `out of ${processes.length} processes`, color: '#10b981' },
    { label: 'Algorithms Compared', value: 3, sub: 'FF · BF · WF', color: '#f59e0b' },
  ];

  const container = document.getElementById('summary-cards');
  container.innerHTML = cards.map((c, i) => `
    <div class="summary-card" style="animation-delay:${i * 0.07}s; border-color: rgba(${hexToRgb(c.color)},0.3)">
      <div class="summary-label">${c.label}</div>
      <div class="summary-value" style="color:${c.color}">${c.value}</div>
      <div class="summary-sub">${c.sub}</div>
    </div>
  `).join('');
}

// ── Algorithm Panel ──────────────────────────────────────────────────────
function renderAlgoPanel(algoId, containerId, result, colors, colorKey) {
  const container = document.getElementById(containerId);
  const accentColor = { ff: 'var(--ff-color)', bf: 'var(--bf-color)', wf: 'var(--wf-color)' }[colorKey];
  const accentLight = { ff: 'var(--ff-light)', bf: 'var(--bf-light)', wf: 'var(--wf-light)' }[colorKey];

  container.innerHTML = `
    ${buildVizSection(result, colors, accentColor)}
    ${buildProcessFlow(result, colors)}
    ${buildAllocTable(result, colors, accentLight)}
    ${buildFragCards(result)}
    ${buildBlocksRemaining(result)}
  `;
}

// ── Memory Visualization ─────────────────────────────────────────────────
function buildVizSection(result, colors, accent) {
  const { blocks, remaining, alloc, processes } = result;
  const maxBlock = Math.max(...blocks);
  const MAX_HEIGHT = 90;  // px

  // Map each block to its process (if any) — last-written wins for simplicity
  const blockProcessMap = {};
  alloc.forEach((b, p) => { if (b !== -1) blockProcessMap[b] = p; });

  const blockHTMLs = blocks.map((size, b) => {
    const usedSize = size - remaining[b];
    const fillPct = size > 0 ? (usedSize / size) : 0;
    const barHeight = Math.max(4, Math.round(fillPct * MAX_HEIGHT));
    const totalHeight = Math.max(30, Math.round((size / maxBlock) * MAX_HEIGHT));
    const procIdx = blockProcessMap[b];
    const hasProc = procIdx !== undefined;
    const [c1, c2] = hasProc ? colors[procIdx % colors.length] : ['#243450','#1e2d44'];
    const procLabel = hasProc ? `P${procIdx+1}` : '';
    const usedLabel = usedSize > 0 ? `${usedSize}` : '';

    return `
      <div class="mem-block" style="animation-delay:${b*0.05}s">
        <div class="mem-block-bar-wrap" style="height:${totalHeight}px; min-width:60px">
          ${hasProc ? `
            <div class="mem-block-used" style="height:${barHeight}px; background: linear-gradient(180deg,${c1},${c2}); position:absolute; bottom:0; width:100%">
              <span class="mem-block-process">${procLabel}</span>
            </div>
          ` : ''}
          ${(!hasProc && remaining[b] < size) ? `
            <div style="position:absolute;bottom:0;width:100%;height:${Math.round(((size-remaining[b])/size)*totalHeight)}px;background:rgba(100,116,139,0.3)"></div>
          ` : ''}
        </div>
        <div class="mem-block-label">B${b+1}</div>
        <div class="mem-block-size">${remaining[b]}/${size}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="viz-section">
      <div class="viz-title">Memory Block Visualization — Remaining / Total Size</div>
      <div class="memory-viz">${blockHTMLs}</div>
    </div>
  `;
}

// ── Process Flow Chips ───────────────────────────────────────────────────
function buildProcessFlow(result, colors) {
  const { processes, alloc } = result;
  const chips = processes.map((size, p) => {
    const blockIdx = alloc[p];
    const allocated = blockIdx !== -1;
    const [c1] = colors[p % colors.length];
    const chipStyle = allocated
      ? `background:rgba(${hexToRgb(c1)},0.15);color:${c1};border-color:rgba(${hexToRgb(c1)},0.35);`
      : '';
    return `
      <div class="proc-chip ${allocated ? 'proc-chip--allocated' : 'proc-chip--failed'}"
           style="${chipStyle}" title="P${p+1}: ${size} units${allocated ? ` → Block ${blockIdx+1}` : ' → Not Allocated'}">
        <span class="proc-chip-dot"></span>
        P${p+1} (${size}) ${allocated ? `→ B${blockIdx+1}` : '✗'}
      </div>
    `;
  }).join('');
  return `<div class="process-flow" style="margin-bottom:24px">${chips}</div>`;
}

// ── Allocation Table ─────────────────────────────────────────────────────
function buildAllocTable(result, colors, accentLight) {
  const { processes, alloc, remaining, blocks } = result;

  const rows = processes.map((size, p) => {
    const blockIdx = alloc[p];
    const allocated = blockIdx !== -1;
    const [c1] = colors[p % colors.length];

    const blockCell = allocated
      ? `<span class="block-badge" style="background:rgba(${hexToRgb(c1)},0.12);color:${c1};border-color:rgba(${hexToRgb(c1)},0.3)">
           Block ${blockIdx+1}
         </span>`
      : `<span style="color:var(--text-muted);font-size:0.78rem">Not Allocated</span>`;

    const remainCell = allocated
      ? `<span style="color:var(--wf-light);font-weight:600">${remaining[blockIdx]}</span>
         <span style="color:var(--text-muted);font-size:0.72rem"> / ${blocks[blockIdx]}</span>`
      : `<span style="color:var(--text-muted)">—</span>`;

    const statusCell = allocated
      ? `<span class="status-badge status-badge--ok">✓ Allocated</span>`
      : `<span class="status-badge status-badge--fail">✗ Failed</span>`;

    const internalFrag = allocated ? remaining[blockIdx] : '—';

    return `
      <tr>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px">
            <span style="width:8px;height:8px;border-radius:50%;background:${c1};display:inline-block;box-shadow:0 0 6px ${c1}"></span>
            P${p+1}
          </span>
        </td>
        <td>${size}</td>
        <td>${blockCell}</td>
        <td>${remainCell}</td>
        <td>${typeof internalFrag === 'number' ? internalFrag : internalFrag}</td>
        <td>${statusCell}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="table-scroll" style="margin-bottom:24px">
      <table class="alloc-table">
        <thead>
          <tr>
            <th>Process</th>
            <th>Size</th>
            <th>Block Allocated</th>
            <th>Block Remaining</th>
            <th>Internal Frag</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

// ── Fragmentation Cards ──────────────────────────────────────────────────
function buildFragCards(result) {
  const { internalFrag, externalFrag, allocatedCount, failedCount, processes } = result;
  const efficiencyPct = processes.length > 0
    ? Math.round((allocatedCount / processes.length) * 100)
    : 0;

  return `
    <div class="frag-grid">
      <div class="frag-card frag-card--internal">
        <div class="frag-icon">🔲</div>
        <div>
          <div class="frag-info-label">Internal Fragmentation</div>
          <div class="frag-info-value">${internalFrag}</div>
          <div class="frag-info-sub">Unused space inside allocated blocks</div>
        </div>
      </div>
      <div class="frag-card frag-card--external">
        <div class="frag-icon">⬜</div>
        <div>
          <div class="frag-info-label">External Fragmentation</div>
          <div class="frag-info-value">${externalFrag}</div>
          <div class="frag-info-sub">Free memory unusable for remaining processes</div>
        </div>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;font-size:0.78rem;color:var(--text-muted)">
      <span style="color:var(--success)">✓ ${allocatedCount} Allocated &nbsp;</span>
      <span style="color:var(--fail)">✗ ${failedCount} Failed &nbsp;</span>
      <span style="color:var(--warn)">⚡ ${efficiencyPct}% Efficiency</span>
    </div>
  `;
}

// ── Block Remaining Section ──────────────────────────────────────────────
function buildBlocksRemaining(result) {
  const { blocks, remaining } = result;
  const cards = blocks.map((orig, b) => {
    const rem = remaining[b];
    const pct = orig > 0 ? Math.round((rem / orig) * 100) : 0;
    return `
      <div class="block-rem">
        <div class="block-rem-label">Block ${b+1}</div>
        <div class="block-rem-orig">${orig} total</div>
        <div class="block-rem-remain">${rem}</div>
        <div class="block-rem-bar">
          <div class="block-rem-bar-fill" style="width:${pct}%"></div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="blocks-remaining">
      <div class="blocks-remaining-title">Memory Block Remaining Sizes</div>
      <div class="blocks-grid">${cards}</div>
    </div>
  `;
}

// ── Comparison Table ─────────────────────────────────────────────────────
function renderComparisonTable(data) {
  const { ff, bf, wf } = data;
  const algos = [
    { name: 'First Fit', dotClass: 'algo-dot--ff', result: ff },
    { name: 'Best Fit',  dotClass: 'algo-dot--bf', result: bf },
    { name: 'Worst Fit', dotClass: 'algo-dot--wf', result: wf },
  ];

  // Determine best/worst for each metric
  const allocated = algos.map(a => a.result.allocatedCount);
  const intFrags   = algos.map(a => a.result.internalFrag);
  const extFrags   = algos.map(a => a.result.externalFrag);

  const maxAlloc = Math.max(...allocated);
  const minAlloc = Math.min(...allocated);
  const minIntFrag = Math.min(...intFrags);
  const maxIntFrag = Math.max(...intFrags);
  const minExtFrag = Math.min(...extFrags);
  const maxExtFrag = Math.max(...extFrags);

  function metricClass(val, best, worst) {
    if (val === best) return 'metric-best';
    if (val === worst) return 'metric-worst';
    return 'metric-mid';
  }

  const rows = algos.map(({ name, dotClass, result }) => {
    const eff = data.processes.length > 0
      ? Math.round((result.allocatedCount / data.processes.length) * 100)
      : 0;
    const isWinnerRow = result.allocatedCount === maxAlloc &&
                        result.internalFrag === minIntFrag ? ' class="winner-highlight"' : '';
    return `
      <tr${isWinnerRow}>
        <td>
          <div class="algo-name-cell">
            <span class="algo-dot ${dotClass}"></span>
            <span class="algo-cell-name">${name}</span>
          </div>
        </td>
        <td><span class="metric-val ${metricClass(result.allocatedCount, maxAlloc, minAlloc)}">${result.allocatedCount} / ${data.processes.length}</span></td>
        <td><span class="metric-val ${metricClass(result.failedCount, 0, Math.max(...algos.map(a=>a.result.failedCount)))}">${result.failedCount}</span></td>
        <td><span class="metric-val ${metricClass(result.internalFrag, minIntFrag, maxIntFrag)}">${result.internalFrag}</span></td>
        <td><span class="metric-val ${metricClass(result.externalFrag, minExtFrag, maxExtFrag)}">${result.externalFrag}</span></td>
        <td><span class="metric-val ${metricClass(eff, Math.max(...algos.map(a=>Math.round((a.result.allocatedCount/data.processes.length)*100))), Math.min(...algos.map(a=>Math.round((a.result.allocatedCount/data.processes.length)*100))))}">${eff}%</span></td>
      </tr>
    `;
  }).join('');

  const table = document.getElementById('comparison-table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Algorithm</th>
        <th>Allocated</th>
        <th>Failed</th>
        <th>Internal Frag</th>
        <th>External Frag</th>
        <th>Efficiency</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

// ── Tab Switching ────────────────────────────────────────────────────────
function switchTab(btn, algoId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.algo-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`panel-${algoId}`).style.display = 'block';
}

// ── Reset ────────────────────────────────────────────────────────────────
function resetAll() {
  document.getElementById('results-section').style.display = 'none';
  document.getElementById('num-blocks').value = 6;
  document.getElementById('num-processes').value = 5;
  generateBlockInputs();
  generateProcessInputs();
  simResults = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Utility: hex to rgb ───────────────────────────────────────────────────
function hexToRgb(hex) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const n = parseInt(hex, 16);
  return `${(n>>16)&255},${(n>>8)&255},${n&255}`;
}

// ── Toast ─────────────────────────────────────────────────────────────────
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position:fixed; bottom:28px; left:50%; transform:translateX(-50%);
      background:#1e293b; color:#f1f5f9; padding:12px 24px;
      border-radius:10px; border:1px solid #334155;
      font-family:Inter,sans-serif; font-size:0.85rem; font-weight:600;
      box-shadow:0 8px 32px rgba(0,0,0,0.5);
      z-index:9999; transition:opacity 0.3s;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

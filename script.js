// ============================================
// CONFIGURATION
// ============================================
const API_BASE = 'https://ai-log-analytics.onrender.com';
let currentPage = 1;
let currentCursor = null;
const PAGE_SIZE = 20;

console.log('🔗 API Base URL:', API_BASE);

// ============================================
// NAVIGATION
// ============================================
document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        const page = this.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        
        if (page === 'logs') loadAllLogs();
        if (page === 'analytics') loadAnalytics();
        if (page === 'performance') loadPerformance();
    });
});

// ============================================
// API TEST
// ============================================
async function testApiConnection() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();
        console.log('✅ API Connected:', data);
        return true;
    } catch (error) {
        console.error('❌ API Connection Failed:', error);
        return false;
    }
}

// ============================================
// LOAD STATS (Dashboard)
// ============================================
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        document.getElementById('totalLogs').textContent = data.total_logs || 0;
        document.getElementById('anomalyCount').textContent = data.anomaly_count || 0;
        
        // Load avg response from analytics
        const analyticsRes = await fetch(`${API_BASE}/api/analytics`);
        const analyticsData = await analyticsRes.json();
        document.getElementById('avgResponse').textContent = `${analyticsData.avg_response_time_ms || 0}ms`;
        
        renderChart('severityChart', data.severity_distribution || {});
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// ============================================
// LOAD LOGS (Dashboard)
// ============================================
async function loadLogs() {
    const severity = document.getElementById('severityFilter').value;
    const source = document.getElementById('sourceFilter').value;
    let url = `${API_BASE}/api/logs?limit=50`;
    if (severity) url += `&severity=${severity}`;
    if (source) url += `&source=${source}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        renderLogs('logsTable', data.logs || []);
        
        // Update performance badge
        const perfBadge = document.getElementById('perfBadge');
        if (data.performance) {
            perfBadge.textContent = `⚡ ${data.performance.query_time_ms}ms`;
        }
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

// ============================================
// LOAD ALL LOGS (Logs Page with Pagination)
// ============================================
async function loadAllLogs() {
    const severity = document.getElementById('logPageSeverityFilter').value;
    const source = document.getElementById('logPageSourceFilter').value;
    let url = `${API_BASE}/api/logs?limit=${PAGE_SIZE}&cursor=${currentCursor || ''}`;
    if (severity) url += `&severity=${severity}`;
    if (source) url += `&source=${source}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        renderLogs('allLogsTable', data.logs || [], true);
        
        document.getElementById('logCount').textContent = `${data.pagination?.total || 0} logs`;
        document.getElementById('paginationInfo').textContent = 
            `Page ${data.pagination?.current_page || 1} of ${data.pagination?.pages || 1}`;
        
        currentCursor = data.pagination?.next_cursor || null;
        
        document.getElementById('prevPageBtn').style.display = (data.pagination?.current_page || 1) > 1 ? 'inline-block' : 'none';
        document.getElementById('nextPageBtn').style.display = currentCursor ? 'inline-block' : 'none';
    } catch (error) {
        console.error('Error loading all logs:', error);
    }
}

// ============================================
// RENDER LOGS
// ============================================
function renderLogs(containerId, logs, showAnomaly = false) {
    const container = document.getElementById(containerId);
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.15);">No logs found</div>';
        return;
    }
    
    let html = `
        <div class="log-row header">
            <span>Time</span>
            <span>Severity</span>
            <span>Message</span>
            <span>Source</span>
            ${showAnomaly ? '<span>Anomaly</span>' : ''}
        </div>
    `;
    
    logs.slice().reverse().forEach(log => {
        const time = new Date(log.timestamp).toLocaleTimeString();
        const severityClass = `severity-${log.severity}`;
        const anomalyBadge = log.is_anomaly ? '🚨' : '✅';
        
        html += `
            <div class="log-row">
                <span>${time}</span>
                <span class="${severityClass}">${log.severity}</span>
                <span>${log.message}</span>
                <span class="source">${log.source || 'unknown'}</span>
                ${showAnomaly ? `<span>${anomalyBadge}</span>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// RENDER CHART
// ============================================
function renderChart(containerId, data) {
    const container = document.getElementById(containerId);
    const colors = { 'INFO': 'info', 'WARNING': 'warning', 'ERROR': 'error', 'CRITICAL': 'critical' };
    const labels = ['INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    const maxVal = Math.max(...Object.values(data), 1);
    
    let html = '';
    labels.forEach(label => {
        const count = data[label] || 0;
        const height = Math.max((count / maxVal) * 80, 8);
        const color = colors[label] || 'info';
        
        html += `
            <div class="chart-bar">
                <div class="bar ${color}" style="height: ${height}px;"></div>
                <span class="count">${count}</span>
                <span class="label">${label}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// ANALYTICS
// ============================================
async function loadAnalytics() {
    try {
        const response = await fetch(`${API_BASE}/api/analytics`);
        const data = await response.json();
        
        document.getElementById('analyticsTotal').textContent = data.total_logs || 0;
        document.getElementById('analyticsAnomaly').textContent = data.anomaly_count || 0;
        document.getElementById('analyticsCritical').textContent = data.severity_distribution?.CRITICAL || 0;
        document.getElementById('analyticsAvgResponse').textContent = `${data.avg_response_time_ms || 0}ms`;
        
        renderChart('analyticsChart', data.severity_distribution || {});
        
        // Source Distribution
        const sources = data.source_distribution || {};
        const sourceContainer = document.getElementById('sourceDistribution');
        let html = '';
        for (const [source, count] of Object.entries(sources)) {
            html += `
                <div class="source-item">
                    <div class="source-name">${source}</div>
                    <div class="source-count">${count}</div>
                </div>
            `;
        }
        sourceContainer.innerHTML = html || '<div style="color:rgba(255,255,255,0.2);padding:20px;">No source data</div>';
        
        // Time Series
        renderTimeSeries(data.time_series || []);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// ============================================
// RENDER TIME SERIES
// ============================================
function renderTimeSeries(data) {
    const container = document.getElementById('timeSeries');
    const maxVal = Math.max(...data.map(d => d.count), 1);
    
    let html = '';
    data.forEach(point => {
        const height = Math.max((point.count / maxVal) * 120, 4);
        const label = point.hour + 'h';
        html += `
            <div class="time-bar" style="height: ${height}px;" title="${point.count} logs at ${label}">
                <span class="time-label">${label}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// PERFORMANCE
// ============================================
async function loadPerformance() {
    try {
        const response = await fetch(`${API_BASE}/api/performance/test`);
        const data = await response.json();
        
        document.getElementById('perfQueryTime').textContent = `${data.query_time_ms || 0}ms`;
        document.getElementById('perfLogsProcessed').textContent = data.logs_processed || 0;
        document.getElementById('perfReduction').textContent = data.reduction_percent || '60%';
        
        // System Metrics
        const statsRes = await fetch(`${API_BASE}/api/stats`);
        const statsData = await statsRes.json();
        
        document.getElementById('systemMetrics').innerHTML = `
            <div>📊 Total Logs: <strong style="color:#fff;">${statsData.total_logs || 0}</strong></div>
            <div>🚨 Anomalies: <strong style="color:#f87171;">${statsData.anomaly_count || 0}</strong></div>
            <div>⚡ Query Time: <strong style="color:#34d399;">${data.query_time_ms || 0}ms</strong></div>
            <div>📈 Aggregation Time: <strong style="color:#60a5fa;">${data.aggregation_time_ms || 0}ms</strong></div>
            <div>💾 Indexing Status: <strong style="color:#fbbf24;">${data.indexing_status || 'optimized'}</strong></div>
            <div>🎯 Latency Reduction: <strong style="color:#34d399;">${data.reduction_percent || '60%'}</strong></div>
        `;
        
        // Performance Chart (mock data)
        renderPerformanceChart();
        
    } catch (error) {
        console.error('Error loading performance:', error);
    }
}

function renderPerformanceChart() {
    const container = document.getElementById('perfChart');
    const data = [
        { label: 'Query', value: 15, color: '#60a5fa' },
        { label: 'Aggregation', value: 25, color: '#fbbf24' },
        { label: 'Indexing', value: 10, color: '#34d399' },
        { label: 'Filtering', value: 20, color: '#818cf8' },
    ];
    const maxVal = Math.max(...data.map(d => d.value), 1);
    
    let html = '';
    data.forEach(item => {
        const height = Math.max((item.value / maxVal) * 80, 8);
        html += `
            <div class="chart-bar">
                <div class="bar" style="height: ${height}px; background: ${item.color};"></div>
                <span class="count">${item.value}ms</span>
                <span class="label">${item.label}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// ============================================
// ANALYZE LOG
// ============================================
async function analyzeLog() {
    const input = document.getElementById('logInput');
    const message = input.value.trim();
    
    if (!message) {
        showResult('❌ Please enter a log message', '', '');
        return;
    }
    
    showResult('⏳ Analyzing...', '', '');
    
    try {
        const response = await fetch(`${API_BASE}/api/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const status = data.is_anomaly ? 'anomaly' : 'normal';
            const emoji = data.is_anomaly ? '🚨' : '✅';
            const label = data.is_anomaly ? 'ANOMALY DETECTED!' : 'Normal Log';
            const details = `Severity: ${data.severity} | Score: ${data.anomaly_score} | Time: ${data.analysis_time_ms}ms`;
            showResult(`${emoji} ${label}`, details, status);
        } else {
            showResult('❌ Error: ' + data.error, '', '');
        }
    } catch (error) {
        showResult('❌ Network error', '', '');
    }
}

// ============================================
// INGEST LOG
// ============================================
async function ingestLog() {
    const input = document.getElementById('logInput');
    const message = input.value.trim();
    
    if (!message) {
        showResult('❌ Please enter a log message', '', '');
        return;
    }
    
    showResult('⏳ Ingesting...', '', '');
    
    try {
        const response = await fetch(`${API_BASE}/api/logs/ingest/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                logs: [{ message: message, source: 'web-ui' }] 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showResult('✅ Ingested successfully', `${data.ingested} logs added`, 'normal');
            input.value = '';
            refreshAll();
        } else {
            showResult('❌ Error: ' + data.error, '', '');
        }
    } catch (error) {
        showResult('❌ Network error', '', '');
    }
}

function showResult(message, details, status) {
    const container = document.getElementById('resultMessage');
    const detailsContainer = document.getElementById('resultDetails');
    
    container.textContent = message;
    container.className = status || '';
    
    detailsContainer.textContent = details || '';
    detailsContainer.style.display = details ? 'block' : 'none';
}

// ============================================
// REFRESH ALL
// ============================================
function refreshAll() {
    loadStats();
    loadLogs();
    loadAllLogs();
    loadAnalytics();
    loadPerformance();
}

// ============================================
// PAGINATION CONTROLS
// ============================================
document.getElementById('prevPageBtn').addEventListener('click', () => {
    currentCursor = null;
    currentPage = Math.max(1, currentPage - 1);
    loadAllLogs();
});

document.getElementById('nextPageBtn').addEventListener('click', () => {
    currentPage += 1;
    loadAllLogs();
});

// ============================================
// EVENT LISTENERS
// ============================================
document.getElementById('analyzeBtn').addEventListener('click', analyzeLog);
document.getElementById('ingestBtn').addEventListener('click', ingestLog);
document.getElementById('refreshBtn').addEventListener('click', () => { loadStats(); loadLogs(); });
document.getElementById('logPageRefreshBtn').addEventListener('click', loadAllLogs);
document.getElementById('severityFilter').addEventListener('change', loadLogs);
document.getElementById('sourceFilter').addEventListener('change', loadLogs);
document.getElementById('logPageSeverityFilter').addEventListener('change', loadAllLogs);
document.getElementById('logPageSourceFilter').addEventListener('change', loadAllLogs);

document.getElementById('logInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeLog();
});

// ============================================
// BULK INGEST
// ============================================
document.getElementById('bulkIngestBtn').addEventListener('click', async () => {
    const input = document.getElementById('logInput');
    const message = input.value.trim();
    
    if (!message) {
        showResult('❌ Please enter a log message', '', '');
        return;
    }
    
    // Generate 10 synthetic logs
    const logs = [];
    for (let i = 0; i < 10; i++) {
        logs.push({
            message: message + ` (batch_${i+1})`,
            source: ['web-server', 'api-server', 'database'][i % 3]
        });
    }
    
    showResult('⏳ Ingesting 10 logs...', '', '');
    
    try {
        const response = await fetch(`${API_BASE}/api/logs/ingest/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs: logs })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showResult('✅ Bulk ingested successfully', `${data.ingested} logs added`, 'normal');
            input.value = '';
            refreshAll();
        } else {
            showResult('❌ Error: ' + data.error, '', '');
        }
    } catch (error) {
        showResult('❌ Network error', '', '');
    }
});

// ============================================
// INITIALIZE
// ============================================
async function init() {
    console.log('🚀 Initializing Log Analytics Platform...');
    
    const connected = await testApiConnection();
    
    if (connected) {
        refreshAll();
        console.log('✅ System ready!');
    } else {
        document.getElementById('totalLogs').textContent = '⚠️';
        document.getElementById('anomalyCount').textContent = '⚠️';
    }
}

// Auto-refresh every 30 seconds
setInterval(() => {
    if (document.getElementById('page-dashboard').classList.contains('active')) {
        loadStats();
        loadLogs();
    }
}, 30000);

init();

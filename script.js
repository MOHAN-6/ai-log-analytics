const API_BASE = window.location.origin;

// ============================================
// NAVIGATION
// ============================================
document.querySelectorAll('.sidebar nav a').forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Update active link
        document.querySelectorAll('.sidebar nav a').forEach(l => l.classList.remove('active'));
        this.classList.add('active');
        
        // Show correct page
        const page = this.dataset.page;
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
        
        // Load data for the page
        if (page === 'logs') loadAllLogs();
        if (page === 'analytics') loadAnalytics();
    });
});

// ============================================
// LOAD STATS (Dashboard)
// ============================================
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        document.getElementById('totalLogs').textContent = data.total_logs || 0;
        document.getElementById('anomalyCount').textContent = data.anomaly_count || 0;
        document.getElementById('normalCount').textContent = (data.total_logs || 0) - (data.anomaly_count || 0);
        
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
    const url = `${API_BASE}/api/logs?limit=100${severity ? `&severity=${severity}` : ''}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        renderLogs('logsTable', data.logs || []);
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

// ============================================
// LOAD ALL LOGS (Logs Page)
// ============================================
async function loadAllLogs() {
    const severity = document.getElementById('logPageSeverityFilter').value;
    const url = `${API_BASE}/api/logs?limit=200${severity ? `&severity=${severity}` : ''}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        renderLogs('allLogsTable', data.logs || [], true);
        document.getElementById('logCount').textContent = `${data.logs?.length || 0} logs`;
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
        const response = await fetch(`${API_BASE}/api/stats`);
        const data = await response.json();
        
        document.getElementById('analyticsTotal').textContent = data.total_logs || 0;
        document.getElementById('analyticsAnomaly').textContent = data.anomaly_count || 0;
        document.getElementById('analyticsCritical').textContent = data.severity_distribution?.CRITICAL || 0;
        
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
        
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
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
            const details = `Severity: ${data.severity} | Anomaly Score: ${data.anomaly_score}`;
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
        const response = await fetch(`${API_BASE}/api/logs/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message, source: 'web-ui' })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            const status = data.is_anomaly ? 'anomaly' : 'normal';
            const emoji = data.is_anomaly ? '🚨' : '✅';
            showResult(`${emoji} Ingested - ${data.severity}`, `Message: ${data.log.message}`, status);
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
}

// ============================================
// EVENT LISTENERS
// ============================================
document.getElementById('analyzeBtn').addEventListener('click', analyzeLog);
document.getElementById('ingestBtn').addEventListener('click', ingestLog);
document.getElementById('refreshBtn').addEventListener('click', () => { loadStats(); loadLogs(); });
document.getElementById('logPageRefreshBtn').addEventListener('click', loadAllLogs);
document.getElementById('severityFilter').addEventListener('change', loadLogs);
document.getElementById('logPageSeverityFilter').addEventListener('change', loadAllLogs);

document.getElementById('logInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeLog();
});

// ============================================
// AUTO-REFRESH
// ============================================
setInterval(() => {
    loadStats();
    loadLogs();
}, 10000);

// ============================================
// INITIALIZE
// ============================================
refreshAll();

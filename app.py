from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
import random
from datetime import datetime, timedelta
import os

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# ============================================
# TRAINING DATA
# ============================================
sample_logs = [
    {"message": "User login successful", "severity": "INFO"},
    {"message": "Database connection established", "severity": "INFO"},
    {"message": "API request processed", "severity": "INFO"},
    {"message": "Cache cleared successfully", "severity": "INFO"},
    {"message": "User logout", "severity": "INFO"},
    {"message": "Disk usage at 85%", "severity": "WARNING"},
    {"message": "High memory usage detected", "severity": "WARNING"},
    {"message": "Slow query execution time", "severity": "WARNING"},
    {"message": "Failed login attempt", "severity": "WARNING"},
    {"message": "Database connection timeout", "severity": "ERROR"},
    {"message": "API endpoint returned 500", "severity": "ERROR"},
    {"message": "File not found error", "severity": "ERROR"},
    {"message": "Authentication failed", "severity": "ERROR"},
    {"message": "System crash detected", "severity": "CRITICAL"},
    {"message": "Data corruption detected", "severity": "CRITICAL"},
    {"message": "Security breach attempt", "severity": "CRITICAL"},
]

# ============================================
# TRAIN SEVERITY CLASSIFIER
# ============================================
X_train = [log["message"] for log in sample_logs]
y_train = [log["severity"] for log in sample_logs]

vectorizer = TfidfVectorizer(max_features=100)
X_train_vec = vectorizer.fit_transform(X_train)

classifier = MultinomialNB()
classifier.fit(X_train_vec, y_train)

# ============================================
# TRAIN ANOMALY DETECTION
# ============================================
def extract_features(message):
    words = message.split()
    return [
        len(words),
        len(message),
        sum(1 for c in message if c.isupper()),
        message.count(' '),
        len([w for w in words if len(w) > 5]),
    ]

X_anomaly = np.array([extract_features(log["message"]) for log in sample_logs])
anomaly_model = IsolationForest(contamination=0.1, random_state=42)
anomaly_model.fit(X_anomaly)

# ============================================
# IN-MEMORY LOG STORE
# ============================================
logs = []
for log in sample_logs:
    logs.append({
        "id": len(logs) + 1,
        "message": log["message"],
        "severity": log["severity"],
        "timestamp": (datetime.now() - timedelta(hours=random.randint(0, 48))).isoformat(),
        "source": random.choice(["web-server", "api-server", "database", "auth-service"]),
        "is_anomaly": False
    })

# ============================================
# API ROUTES
# ============================================

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/health')
def health():
    return jsonify({
        "status": "healthy",
        "logs_count": len(logs),
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/logs')
def get_logs():
    severity = request.args.get('severity')
    limit = int(request.args.get('limit', 50))
    
    filtered = logs
    if severity:
        filtered = [l for l in filtered if l["severity"] == severity]
    
    return jsonify({
        "logs": filtered[-limit:],
        "total": len(filtered)
    })

@app.route('/api/logs/ingest', methods=['POST'])
def ingest_log():
    data = request.get_json()
    
    if not data or 'message' not in data:
        return jsonify({"error": "Missing 'message'"}), 400
    
    message = data['message']
    source = data.get('source', 'web-ui')
    
    # Predict severity
    X_pred = vectorizer.transform([message])
    severity = classifier.predict(X_pred)[0]
    
    # Detect anomaly
    features = extract_features(message)
    is_anomaly = anomaly_model.predict([features])[0] == -1
    
    log_entry = {
        "id": len(logs) + 1,
        "message": message,
        "severity": severity,
        "timestamp": datetime.now().isoformat(),
        "source": source,
        "is_anomaly": is_anomaly
    }
    
    logs.append(log_entry)
    
    return jsonify({
        "success": True,
        "log": log_entry,
        "severity": severity,
        "is_anomaly": is_anomaly
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_log():
    data = request.get_json()
    
    if not data or 'message' not in data:
        return jsonify({"error": "Missing 'message'"}), 400
    
    message = data['message']
    
    # Predict severity
    X_pred = vectorizer.transform([message])
    severity = classifier.predict(X_pred)[0]
    probabilities = classifier.predict_proba(X_pred)[0]
    
    # Detect anomaly
    features = extract_features(message)
    is_anomaly = anomaly_model.predict([features])[0] == -1
    anomaly_score = float(anomaly_model.score_samples([features])[0])
    
    severity_probs = {
        severity: round(float(prob), 3) 
        for severity, prob in zip(classifier.classes_, probabilities)
    }
    
    return jsonify({
        "message": message,
        "severity": severity,
        "is_anomaly": is_anomaly,
        "anomaly_score": round(anomaly_score, 4),
        "severity_probabilities": severity_probs,
        "features": features
    })

@app.route('/api/stats')
def get_stats():
    severity_counts = {}
    source_counts = {}
    anomaly_count = 0
    
    for log in logs:
        severity_counts[log["severity"]] = severity_counts.get(log["severity"], 0) + 1
        source_counts[log["source"]] = source_counts.get(log["source"], 0) + 1
        if log.get("is_anomaly", False):
            anomaly_count += 1
    
    return jsonify({
        "total_logs": len(logs),
        "severity_distribution": severity_counts,
        "source_distribution": source_counts,
        "anomaly_count": anomaly_count
    })

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=True)

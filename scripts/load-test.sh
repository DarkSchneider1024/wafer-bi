#!/bin/bash
# ====================
# Load Test Script
# Demonstrates HPA autoscaling in action
# ====================

set -e

echo "🔥 K8S Demo Load Test"
echo "====================="
echo ""

# Check if 'hey' is installed (HTTP load testing tool)
if ! command -v hey &> /dev/null; then
    echo "Installing 'hey' load testing tool..."
    echo "  go install github.com/rakyll/hey@latest"
    echo "  or download from: https://github.com/rakyll/hey"
    echo ""
    echo "Alternative: using curl in a loop"
    echo ""

    TARGET_URL="${1:-http://localhost:8080/api/products}"
    DURATION="${2:-60}"
    CONCURRENCY="${3:-50}"

    echo "📊 Target: ${TARGET_URL}"
    echo "⏱️  Duration: ${DURATION}s"
    echo "👥 Concurrency: ${CONCURRENCY}"
    echo ""
    echo "Starting load test..."
    echo ""

    # Simple curl-based load test
    end=$((SECONDS + DURATION))
    count=0
    while [ $SECONDS -lt $end ]; do
        for i in $(seq 1 $CONCURRENCY); do
            curl -s -o /dev/null -w "%{http_code}" "$TARGET_URL" &
        done
        wait
        count=$((count + CONCURRENCY))
        echo "  Requests sent: $count"
        sleep 0.5
    done

    echo ""
    echo "✅ Load test complete! Total requests: $count"
    exit 0
fi

TARGET_URL="${1:-http://localhost:8080/api/products}"
DURATION="${2:-60}"
CONCURRENCY="${3:-50}"

echo "📊 Target: ${TARGET_URL}"
echo "⏱️  Duration: ${DURATION}s"
echo "👥 Concurrency: ${CONCURRENCY}"
echo ""

echo "▶️  Watch HPA scaling in another terminal:"
echo "   kubectl get hpa -n k8sdemo -w"
echo ""
echo "▶️  Watch pods in another terminal:"
echo "   kubectl get pods -n k8sdemo -w"
echo ""

echo "Starting load test in 3 seconds..."
sleep 3

hey -z "${DURATION}s" -c "$CONCURRENCY" "$TARGET_URL"

echo ""
echo "✅ Load test complete!"
echo ""
echo "📊 Check HPA status:"
echo "   kubectl get hpa -n k8sdemo"
echo ""
echo "📊 Check pod count:"
echo "   kubectl get pods -n k8sdemo | grep -c Running"

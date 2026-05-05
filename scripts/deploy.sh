#!/bin/bash
# ====================
# Deploy Script
# Deploys all K8S resources in the correct order
# ====================

set -e

NAMESPACE="k8sdemo"

echo "🚀 Deploying K8S Demo to namespace: ${NAMESPACE}"
echo "================================================"
echo ""

# Step 1: Create namespace
echo "📦 Step 1: Creating namespace..."
kubectl apply -f k8s/namespace.yaml
echo "✅ Namespace created"
echo ""

# Step 2: Apply ConfigMap and Secrets
echo "🔧 Step 2: Applying ConfigMap & Secrets..."
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
echo "✅ Config applied"
echo ""

# Step 3: Deploy databases first
echo "💾 Step 3: Deploying databases..."
kubectl apply -f k8s/databases/
echo "⏳ Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s
echo "✅ Databases ready"
echo ""

# Step 4: Deploy backend services
echo "⚙️  Step 4: Deploying backend services..."
kubectl apply -f k8s/product-service/
kubectl apply -f k8s/order-service/
kubectl apply -f k8s/user-service/
echo "⏳ Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=product-service -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=order-service -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=user-service -n $NAMESPACE --timeout=120s
echo "✅ Backend services ready"
echo ""

# Step 5: Deploy API Gateway
echo "🌐 Step 5: Deploying API Gateway..."
kubectl apply -f k8s/api-gateway/
kubectl wait --for=condition=ready pod -l app=api-gateway -n $NAMESPACE --timeout=120s
echo "✅ API Gateway ready"
echo ""

# Step 6: Deploy Frontend
echo "🎨 Step 6: Deploying Frontend..."
kubectl apply -f k8s/frontend/
echo "✅ Frontend deployed"
echo ""

# Step 7: Apply Ingress
echo "🔗 Step 7: Applying Ingress..."
kubectl apply -f k8s/ingress.yaml
echo "✅ Ingress applied"
echo ""

# Step 8: Apply Network Policies
echo "🔒 Step 8: Applying Network Policies..."
kubectl apply -f k8s/network-policy.yaml
echo "✅ Network Policies applied"
echo ""

# Summary
echo ""
echo "================================================"
echo "🎉 Deployment Complete!"
echo "================================================"
echo ""
echo "📊 Resources:"
kubectl get all -n $NAMESPACE
echo ""
echo "📊 HPA Status:"
kubectl get hpa -n $NAMESPACE
echo ""
echo "📊 PVC Status:"
kubectl get pvc -n $NAMESPACE
echo ""
echo "🌐 Add this to /etc/hosts:"
echo "   127.0.0.1 k8sdemo.local"
echo ""
echo "🔗 Access the app at: http://k8sdemo.local"

# ====================
# K8SDemo - Windows Deploy Script (PowerShell)
# Deploys all K8S resources to Minikube in the correct order
# ====================

$ErrorActionPreference = "Stop"
$NAMESPACE = "k8sdemo"
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  K8SDemo - Minikube Deployment Script (Windows)" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# --------------------------------------------------
# Step 0: Verify prerequisites
# --------------------------------------------------
Write-Host "[Step 0] Checking prerequisites..." -ForegroundColor Yellow

$minikubePath = "$env:LOCALAPPDATA\minikube"
if ($env:Path -notlike "*$minikubePath*") {
    $env:Path += ";$minikubePath"
}

$requiredTools = @("docker", "kubectl", "minikube")
foreach ($tool in $requiredTools) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        Write-Host "  ERROR: '$tool' is not installed or not in PATH." -ForegroundColor Red
        exit 1
    }
}
Write-Host "  All tools found: docker, kubectl, minikube" -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 1: Start Minikube (if not running)
# --------------------------------------------------
Write-Host "[Step 1] Starting Minikube cluster..." -ForegroundColor Yellow

$minikubeStatus = minikube status --format="{{.Host}}" 2>$null
if ($minikubeStatus -eq "Running") {
    Write-Host "  Minikube is already running." -ForegroundColor Green
} else {
    Write-Host "  Starting Minikube with Docker driver..."
    minikube start --driver=docker --cpus=4 --memory=4096 --disk-size=20g
    Write-Host "  Minikube started successfully." -ForegroundColor Green
}
Write-Host ""

# --------------------------------------------------
# Step 2: Enable required addons
# --------------------------------------------------
Write-Host "[Step 2] Enabling Minikube addons..." -ForegroundColor Yellow

$addons = @("ingress", "metrics-server", "storage-provisioner")
foreach ($addon in $addons) {
    Write-Host "  Enabling $addon..."
    minikube addons enable $addon 2>$null
}
Write-Host "  Addons enabled." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 3: Configure Docker to use Minikube's daemon
# --------------------------------------------------
Write-Host "[Step 3] Configuring Docker to use Minikube daemon..." -ForegroundColor Yellow
Write-Host "  Running: minikube docker-env | Invoke-Expression"

# Set minikube docker env for this session
& minikube -p minikube docker-env --shell powershell | Invoke-Expression

Write-Host "  Docker is now pointing to Minikube's daemon." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 4: Build Docker images inside Minikube
# --------------------------------------------------
Write-Host "[Step 4] Building Docker images..." -ForegroundColor Yellow

$services = @(
    @{ Name = "product-service"; Path = "$PROJECT_ROOT/services/product-service" },
    @{ Name = "order-service";   Path = "$PROJECT_ROOT/services/order-service" },
    @{ Name = "user-service";    Path = "$PROJECT_ROOT/services/user-service" },
    @{ Name = "api-gateway";     Path = "$PROJECT_ROOT/services/api-gateway" },
    @{ Name = "frontend";        Path = "$PROJECT_ROOT/services/frontend" }
)

foreach ($svc in $services) {
    Write-Host "  Building k8sdemo/$($svc.Name):latest ..."
    docker build -t "k8sdemo/$($svc.Name):latest" $svc.Path
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ERROR: Failed to build $($svc.Name)" -ForegroundColor Red
        exit 1
    }
}
Write-Host "  All images built successfully." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 5: Create namespace
# --------------------------------------------------
Write-Host "[Step 5] Creating namespace..." -ForegroundColor Yellow
kubectl apply -f "$PROJECT_ROOT/k8s/namespace.yaml"
Write-Host "  Namespace '$NAMESPACE' created." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 6: Apply ConfigMap & Secrets
# --------------------------------------------------
Write-Host "[Step 6] Applying ConfigMap & Secrets..." -ForegroundColor Yellow
kubectl apply -f "$PROJECT_ROOT/k8s/configmap.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/secrets.yaml"
Write-Host "  Config applied." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 7: Deploy databases
# --------------------------------------------------
Write-Host "[Step 7] Deploying databases (PostgreSQL + Redis)..." -ForegroundColor Yellow
kubectl apply -f "$PROJECT_ROOT/k8s/databases/"
Write-Host "  Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n $NAMESPACE --timeout=120s
Write-Host "  Waiting for Redis to be ready..."
kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=60s
Write-Host "  Databases are ready." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 8: Deploy backend services
# --------------------------------------------------
Write-Host "[Step 8] Deploying backend services..." -ForegroundColor Yellow
kubectl apply -f "$PROJECT_ROOT/k8s/product-service/"
kubectl apply -f "$PROJECT_ROOT/k8s/order-service/"
kubectl apply -f "$PROJECT_ROOT/k8s/user-service/"
Write-Host "  Waiting for backend services..."
kubectl wait --for=condition=ready pod -l app=product-service -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=order-service -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=user-service -n $NAMESPACE --timeout=120s
Write-Host "  Backend services ready." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 9: Deploy API Gateway
# --------------------------------------------------
Write-Host "[Step 9] Deploying API Gateway..." -ForegroundColor Yellow
kubectl apply -f "$PROJECT_ROOT/k8s/api-gateway/"
kubectl wait --for=condition=ready pod -l app=api-gateway -n $NAMESPACE --timeout=120s
Write-Host "  API Gateway ready." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 10: Deploy Frontend
# --------------------------------------------------
Write-Host "[Step 10] Deploying Frontend..." -ForegroundColor Yellow
kubectl apply -f "$PROJECT_ROOT/k8s/frontend/"
kubectl wait --for=condition=ready pod -l app=frontend -n $NAMESPACE --timeout=60s
Write-Host "  Frontend deployed." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Step 11: Apply Ingress & Network Policies
# --------------------------------------------------
Write-Host "[Step 11] Applying Ingress & Network Policies..." -ForegroundColor Yellow
kubectl apply -f "$PROJECT_ROOT/k8s/ingress.yaml"
kubectl apply -f "$PROJECT_ROOT/k8s/network-policy.yaml"
Write-Host "  Ingress & Network Policies applied." -ForegroundColor Green
Write-Host ""

# --------------------------------------------------
# Summary
# --------------------------------------------------
Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""

Write-Host "[Resources]" -ForegroundColor Cyan
kubectl get all -n $NAMESPACE
Write-Host ""

Write-Host "[HPA Status]" -ForegroundColor Cyan
kubectl get hpa -n $NAMESPACE
Write-Host ""

Write-Host "[PVC Status]" -ForegroundColor Cyan
kubectl get pvc -n $NAMESPACE
Write-Host ""

# Get Minikube IP
$MINIKUBE_IP = minikube ip
Write-Host "[Next Steps]" -ForegroundColor Yellow
Write-Host "  1. Add to C:\Windows\System32\drivers\etc\hosts:" -ForegroundColor White
Write-Host "     $MINIKUBE_IP k8sdemo.local" -ForegroundColor White
Write-Host ""
Write-Host "  2. Open Minikube tunnel (run in a separate terminal as Admin):" -ForegroundColor White
Write-Host "     minikube tunnel" -ForegroundColor White
Write-Host ""
Write-Host "  3. Access the app:" -ForegroundColor White
Write-Host "     http://k8sdemo.local" -ForegroundColor White
Write-Host ""
Write-Host "[Useful Commands]" -ForegroundColor Yellow
Write-Host "  minikube dashboard          # Open K8S Dashboard" -ForegroundColor Gray
Write-Host "  kubectl logs -f <pod> -n k8sdemo  # View pod logs" -ForegroundColor Gray
Write-Host "  kubectl get hpa -n k8sdemo -w     # Watch HPA scaling" -ForegroundColor Gray
Write-Host "  minikube stop               # Stop cluster" -ForegroundColor Gray
Write-Host "  minikube delete             # Delete cluster" -ForegroundColor Gray
Write-Host ""

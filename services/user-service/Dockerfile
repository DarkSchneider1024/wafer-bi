# ---- Build Stage ----
FROM maven:3.9-eclipse-temurin-21 AS builder
WORKDIR /app

# Cache dependencies first (Docker layer caching optimization)
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Build the application
COPY src/ ./src/
RUN mvn package -DskipTests -B

# ---- Agent Downloader ----
FROM alpine:latest AS agent-downloader
WORKDIR /agent
RUN apk add --no-cache curl
RUN curl -L https://github.com/open-telemetry/opentelemetry-java-instrumentation/releases/latest/download/opentelemetry-javaagent.jar -o opentelemetry-javaagent.jar

# ---- Production Stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app

# Security: run as non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh appuser

COPY --from=builder /app/target/*.jar app.jar
COPY --from=agent-downloader /agent/opentelemetry-javaagent.jar .

USER appuser

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002/healthz || exit 1

# JVM tuning and OTel Agent integration
CMD ["java", \
     "-javaagent:opentelemetry-javaagent.jar", \
     "-Dotel.service.name=user-service", \
     "-Dotel.exporter.otlp.endpoint=http://otel-collector-service.k8sdemo.svc.cluster.local:4317", \
     "-XX:+UseContainerSupport", \
     "-XX:MaxRAMPercentage=75.0", \
     "-Djava.security.egd=file:/dev/./urandom", \
     "-jar", "app.jar"]

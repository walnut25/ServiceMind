FROM maven:3.9.11-eclipse-temurin-21-alpine AS builder

WORKDIR /workspace

COPY pom.xml .
COPY src ./src
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -ntp -Dmaven.test.skip=true package \
    && cp target/*.jar app.jar

FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S smartservice \
    && adduser -S smartservice -G smartservice

WORKDIR /app

COPY --from=builder --chown=smartservice:smartservice /workspace/app.jar app.jar

USER smartservice

EXPOSE 8081

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=6 \
    CMD wget --quiet --spider http://localhost:8081/actuator/health || exit 1

ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]

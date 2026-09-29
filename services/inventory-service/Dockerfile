FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B clean package -DskipTests

FROM eclipse-temurin:21-jre-alpine
# Utilisateur non-root. UID/GID 1000 = propriétaire de ./secrets sur l'hôte
# (clés JWT en 600), seul moyen de lire le secret monté sans l'ouvrir à tous.
RUN addgroup -S -g 1000 app && adduser -S -u 1000 -G app -H app
WORKDIR /app
COPY --from=build --chown=app:app /app/target/*.jar app.jar
USER app
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-Djava.security.egd=file:/dev/urandom", "-jar", "app.jar"]

FROM eclipse-temurin:25-jdk-alpine AS build
WORKDIR /src
COPY pom.xml .
COPY src ./src
RUN apk add --no-cache maven && mvn -q -DskipTests package

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
COPY --from=build /src/target/orarepot-gateway-1.0.0.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

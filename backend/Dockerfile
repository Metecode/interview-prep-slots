# Bağlam repo kökü (docker-compose.yml: context: ., dockerfile: backend/Dockerfile)
# olduğu için tüm COPY kaynakları backend/'e göre değil repo köküne göre.

# ---- Derleme aşaması ----
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

COPY backend/mvnw .
COPY backend/.mvn .mvn
COPY backend/pom.xml .
RUN chmod +x mvnw && ./mvnw -B dependency:go-offline

# pom.xml'deki maven-resources-plugin soru içeriğini
# ${project.basedir}/../src/content/tr'den kopyalıyor; basedir /app olduğu
# için frontend içeriği /src/content/tr'ye, WORKDIR'in dışına konuyor.
COPY src/content/tr /src/content/tr

COPY backend/src src
RUN ./mvnw -B clean package -DskipTests

# ---- Çalıştırma aşaması ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

COPY --from=build /app/target/*.jar app.jar

# JVM konteynerde heap sınırını kendisi koymazsa host belleğinin çeyreğini
# almaya çalışır; -Xmx512m ile konteyner limitine uygun bir sınır koyuyoruz.
ENV JAVA_OPTS="-Xmx512m"

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

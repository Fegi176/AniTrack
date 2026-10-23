FROM node:24-alpine AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /source
COPY backend/AnimeTracker.Api/AnimeTracker.Api.csproj backend/AnimeTracker.Api/
RUN dotnet restore backend/AnimeTracker.Api
COPY backend/AnimeTracker.Api/ backend/AnimeTracker.Api/
RUN dotnet publish backend/AnimeTracker.Api -c Release -o /out --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /out .
COPY --from=web /web/dist ./wwwroot
RUN mkdir -p App_Data && chown -R app:app /app
USER app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "AnimeTracker.Api.dll"]

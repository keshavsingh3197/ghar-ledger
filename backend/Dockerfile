# syntax=docker/dockerfile:1.7
# Build context is the repo's backend/ directory (Render "Root Directory" = backend).
# ---- Build stage ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore first (layer-cached) using just the project file + NuGet source config.
COPY nuget.config ./
COPY GharLedger.Api/GharLedger.Api.csproj GharLedger.Api/
RUN --mount=type=secret,id=PACKAGES_READ_TOKEN,required=false \
    if [ -f /run/secrets/PACKAGES_READ_TOKEN ]; then \
        export PACKAGES_READ_TOKEN="$(cat /run/secrets/PACKAGES_READ_TOKEN)"; \
    elif [ -z "${PACKAGES_READ_TOKEN:-}" ]; then \
        echo "PACKAGES_READ_TOKEN is required to restore private GitHub Packages." >&2; \
        exit 1; \
    fi \
    && dotnet restore GharLedger.Api/GharLedger.Api.csproj --configfile /src/nuget.config

# Then copy the rest and publish (no second restore).
COPY GharLedger.Api/ GharLedger.Api/
RUN dotnet publish GharLedger.Api/GharLedger.Api.csproj -c Release -o /app/publish /p:UseAppHost=false --no-restore

# ---- Runtime stage ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "GharLedger.Api.dll"]

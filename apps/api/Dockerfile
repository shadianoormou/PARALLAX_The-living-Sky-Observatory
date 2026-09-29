FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY apps/api/Parallax.Api.csproj apps/api/
RUN dotnet restore apps/api/Parallax.Api.csproj
COPY apps/api apps/api
RUN dotnet publish apps/api/Parallax.Api.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /out .
EXPOSE 5080
ENTRYPOINT ["dotnet", "Parallax.Api.dll"]

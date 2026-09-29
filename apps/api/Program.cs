using Microsoft.EntityFrameworkCore;
using Parallax.Api;
using Parallax.Api.Data;
using Parallax.Api.Services;

var builder = WebApplication.CreateBuilder(args);

var corsOrigins = builder.Configuration["PARALLAX_CORS_ORIGINS"]?
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
    ?? ["http://localhost:3000"];

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy.WithOrigins(corsOrigins).AllowAnyHeader().AllowAnyMethod()));
builder.Services.AddDbContext<ParallaxDbContext>(options => options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddHttpClient<IScienceServiceClient, ScienceServiceClient>((serviceProvider, client) =>
{
    var baseUrl = serviceProvider.GetRequiredService<IConfiguration>()["ScienceService:BaseUrl"] ?? "http://localhost:8001/";
    client.BaseAddress = new Uri(baseUrl, UriKind.Absolute);
    client.Timeout = TimeSpan.FromSeconds(60);
});
builder.Services.AddScoped<DemoAnalysisService>();
builder.Services.AddScoped<ConsensusService>();
builder.Services.AddScoped<PassportService>();
builder.Services.AddHealthChecks();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();
app.UseExceptionHandler();
app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();

app.MapGet("/health", () => Results.Ok(new { service = "parallax-api", status = "ok", phase = "persistence-and-integration" }));
app.MapGet("/api/v1/health", () => Results.Ok(new { service = "parallax-api", status = "ok", phase = "persistence-and-integration" }));
app.MapHealthChecks("/health/ready");
app.MapParallaxEndpoints();

app.Run();

public partial class Program;

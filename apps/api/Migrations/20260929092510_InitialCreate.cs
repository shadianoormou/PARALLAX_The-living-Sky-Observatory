using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Parallax.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Achievements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Key = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Achievements", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AuditEntries",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Action = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    ActorKey = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    EntityType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    EntityId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditEntries", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "DatasetSources",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    DatasetType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    SourceIdentifier = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    RetrievalTimestampUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProvenanceJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DatasetSources", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SkyRegions",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    CenterRightAscensionDeg = table.Column<double>(type: "float", nullable: false),
                    CenterDeclinationDeg = table.Column<double>(type: "float", nullable: false),
                    WidthPixels = table.Column<int>(type: "int", nullable: false),
                    HeightPixels = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SkyRegions", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "UserProfiles",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ExternalKey = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    DisplayName = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserProfiles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProcessingRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DatasetSourceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AlgorithmVersion = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    StartedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CompletedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ParametersJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ResultJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ErrorMessage = table.Column<string>(type: "nvarchar(max)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessingRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProcessingRuns_DatasetSources_DatasetSourceId",
                        column: x => x.DatasetSourceId,
                        principalTable: "DatasetSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Observations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    DatasetSourceId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SkyRegionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    ObservationIdentifier = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Label = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    CoordinateFrame = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    PixelScaleArcsec = table.Column<double>(type: "float", nullable: false),
                    ShapeJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    ProvenanceJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Observations", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Observations_DatasetSources_DatasetSourceId",
                        column: x => x.DatasetSourceId,
                        principalTable: "DatasetSources",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Observations_SkyRegions_SkyRegionId",
                        column: x => x.SkyRegionId,
                        principalTable: "SkyRegions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "UserAchievements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    AchievementId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EarnedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAchievements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserAchievements_Achievements_AchievementId",
                        column: x => x.AchievementId,
                        principalTable: "Achievements",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserAchievements_UserProfiles_UserProfileId",
                        column: x => x.UserProfileId,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Candidates",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ProcessingRunId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SkyRegionId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    CandidateKey = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Classification = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Interpretation = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    Status = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "SYSUTCDATETIME()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Candidates", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Candidates_ProcessingRuns_ProcessingRunId",
                        column: x => x.ProcessingRunId,
                        principalTable: "ProcessingRuns",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Candidates_SkyRegions_SkyRegionId",
                        column: x => x.SkyRegionId,
                        principalTable: "SkyRegions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "ObservationEpochs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ObservationId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    EpochCode = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: false),
                    CapturedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ImageArtifactPath = table.Column<string>(type: "nvarchar(260)", maxLength: 260, nullable: true),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ObservationEpochs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ObservationEpochs_Observations_ObservationId",
                        column: x => x.ObservationId,
                        principalTable: "Observations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidateMeasurements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MetricName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Value = table.Column<double>(type: "float", nullable: true),
                    Unit = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    Uncertainty = table.Column<double>(type: "float", nullable: true),
                    MetadataJson = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateMeasurements", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateMeasurements_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CandidateSpectra",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    SourceId = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    WavelengthUmJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FluxEpochAJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    FluxEpochBJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    DeltaFluxJson = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Interpretation = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CandidateSpectra", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CandidateSpectra_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ClassificationConsensuses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ClassificationLabel = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    VoteCount = table.Column<int>(type: "int", nullable: false),
                    TotalVotes = table.Column<int>(type: "int", nullable: false),
                    AgreementFraction = table.Column<double>(type: "float", nullable: false),
                    CalculatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassificationConsensuses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClassificationConsensuses_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Classifications",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CandidateId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserProfileId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Label = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Notes = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Classifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Classifications_Candidates_CandidateId",
                        column: x => x.CandidateId,
                        principalTable: "Candidates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Classifications_UserProfiles_UserProfileId",
                        column: x => x.UserProfileId,
                        principalTable: "UserProfiles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Achievements_Key",
                table: "Achievements",
                column: "Key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CandidateMeasurements_CandidateId",
                table: "CandidateMeasurements",
                column: "CandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_ProcessingRunId_CandidateKey",
                table: "Candidates",
                columns: new[] { "ProcessingRunId", "CandidateKey" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Candidates_SkyRegionId",
                table: "Candidates",
                column: "SkyRegionId");

            migrationBuilder.CreateIndex(
                name: "IX_CandidateSpectra_CandidateId",
                table: "CandidateSpectra",
                column: "CandidateId");

            migrationBuilder.CreateIndex(
                name: "IX_ClassificationConsensuses_CandidateId_ClassificationLabel",
                table: "ClassificationConsensuses",
                columns: new[] { "CandidateId", "ClassificationLabel" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Classifications_CandidateId_UserProfileId",
                table: "Classifications",
                columns: new[] { "CandidateId", "UserProfileId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Classifications_UserProfileId",
                table: "Classifications",
                column: "UserProfileId");

            migrationBuilder.CreateIndex(
                name: "IX_DatasetSources_DatasetType_SourceIdentifier",
                table: "DatasetSources",
                columns: new[] { "DatasetType", "SourceIdentifier" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ObservationEpochs_ObservationId_EpochCode",
                table: "ObservationEpochs",
                columns: new[] { "ObservationId", "EpochCode" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Observations_DatasetSourceId",
                table: "Observations",
                column: "DatasetSourceId");

            migrationBuilder.CreateIndex(
                name: "IX_Observations_ObservationIdentifier",
                table: "Observations",
                column: "ObservationIdentifier",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Observations_SkyRegionId",
                table: "Observations",
                column: "SkyRegionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingRuns_DatasetSourceId",
                table: "ProcessingRuns",
                column: "DatasetSourceId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessingRuns_StartedAtUtc",
                table: "ProcessingRuns",
                column: "StartedAtUtc");

            migrationBuilder.CreateIndex(
                name: "IX_SkyRegions_Name",
                table: "SkyRegions",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAchievements_AchievementId",
                table: "UserAchievements",
                column: "AchievementId");

            migrationBuilder.CreateIndex(
                name: "IX_UserAchievements_UserProfileId_AchievementId",
                table: "UserAchievements",
                columns: new[] { "UserProfileId", "AchievementId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserProfiles_ExternalKey",
                table: "UserProfiles",
                column: "ExternalKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AuditEntries");

            migrationBuilder.DropTable(
                name: "CandidateMeasurements");

            migrationBuilder.DropTable(
                name: "CandidateSpectra");

            migrationBuilder.DropTable(
                name: "ClassificationConsensuses");

            migrationBuilder.DropTable(
                name: "Classifications");

            migrationBuilder.DropTable(
                name: "ObservationEpochs");

            migrationBuilder.DropTable(
                name: "UserAchievements");

            migrationBuilder.DropTable(
                name: "Candidates");

            migrationBuilder.DropTable(
                name: "Observations");

            migrationBuilder.DropTable(
                name: "Achievements");

            migrationBuilder.DropTable(
                name: "UserProfiles");

            migrationBuilder.DropTable(
                name: "ProcessingRuns");

            migrationBuilder.DropTable(
                name: "SkyRegions");

            migrationBuilder.DropTable(
                name: "DatasetSources");
        }
    }
}

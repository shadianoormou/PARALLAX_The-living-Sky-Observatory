using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Parallax.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddClassificationConfidence : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Confidence",
                table: "Classifications",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Confidence",
                table: "Classifications");
        }
    }
}

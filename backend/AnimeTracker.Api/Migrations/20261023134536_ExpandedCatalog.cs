using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class ExpandedCatalog : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDemo",
                table: "AspNetUsers",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.Sql("UPDATE AspNetUsers SET IsDemo = 1 WHERE UserName LIKE 'guest-%' AND PasswordHash IS NULL;");

            migrationBuilder.AddColumn<string>(
                name: "AlternativeTitles",
                table: "Anime",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<int>(
                name: "FeaturedOrder",
                table: "Anime",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "SourceUrl",
                table: "Anime",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "CatalogSnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Version = table.Column<string>(type: "TEXT", nullable: false),
                    SourceName = table.Column<string>(type: "TEXT", nullable: false),
                    SourceUrl = table.Column<string>(type: "TEXT", nullable: false),
                    LastUpdated = table.Column<string>(type: "TEXT", nullable: false),
                    LicenseName = table.Column<string>(type: "TEXT", nullable: false),
                    LicenseUrl = table.Column<string>(type: "TEXT", nullable: false),
                    TitleCount = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CatalogSnapshots", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CatalogSnapshots");

            migrationBuilder.DropColumn(
                name: "IsDemo",
                table: "AspNetUsers");

            migrationBuilder.DropColumn(
                name: "AlternativeTitles",
                table: "Anime");

            migrationBuilder.DropColumn(
                name: "FeaturedOrder",
                table: "Anime");

            migrationBuilder.DropColumn(
                name: "SourceUrl",
                table: "Anime");
        }
    }
}

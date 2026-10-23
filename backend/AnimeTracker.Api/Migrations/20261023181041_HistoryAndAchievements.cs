using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AnimeTracker.Api.Migrations
{
    /// <inheritdoc />
    public partial class HistoryAndAchievements : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Achievements",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    Code = table.Column<string>(type: "TEXT", maxLength: 64, nullable: false),
                    UnlockedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Achievements", x => new { x.UserId, x.Code });
                    table.ForeignKey(
                        name: "FK_Achievements_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Activities",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    UserId = table.Column<string>(type: "TEXT", nullable: false),
                    AnimeId = table.Column<int>(type: "INTEGER", nullable: true),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Kind = table.Column<string>(type: "TEXT", nullable: false),
                    FromStatus = table.Column<string>(type: "TEXT", nullable: true),
                    ToStatus = table.Column<string>(type: "TEXT", nullable: true),
                    FromEpisodes = table.Column<int>(type: "INTEGER", nullable: true),
                    ToEpisodes = table.Column<int>(type: "INTEGER", nullable: true),
                    FromScore = table.Column<int>(type: "INTEGER", nullable: true),
                    ToScore = table.Column<int>(type: "INTEGER", nullable: true),
                    NotesChanged = table.Column<bool>(type: "INTEGER", nullable: false),
                    ImportedAdded = table.Column<int>(type: "INTEGER", nullable: false),
                    ImportedUpdated = table.Column<int>(type: "INTEGER", nullable: false),
                    ImportedSkipped = table.Column<int>(type: "INTEGER", nullable: false),
                    OccurredAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Activities", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Activities_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Activities_UserId_OccurredAt_Id",
                table: "Activities",
                columns: new[] { "UserId", "OccurredAt", "Id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Achievements");

            migrationBuilder.DropTable(
                name: "Activities");
        }
    }
}

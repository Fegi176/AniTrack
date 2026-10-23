using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AnimeTracker.Api.Features;
using AnimeTracker.Api.Domain;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.EntityFrameworkCore;
using AnimeTracker.Api.Data;
using System.Net.Http.Headers;
using SkiaSharp;

namespace AnimeTracker.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    private readonly string database = Path.Combine(Path.GetTempPath(), $"animetrack-test-{Guid.NewGuid():N}.db");
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        { ["ConnectionStrings:Default"] = $"Data Source={database}", ["Demo:Enabled"] = "true" }));
        builder.ConfigureLogging(logging => logging.ClearProviders());
    }
    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();
            foreach (var suffix in new[] { "", "-wal", "-shm" })
                if (File.Exists(database + suffix)) File.Delete(database + suffix);
        }
    }
}

public sealed class ApiTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    { Converters = { new JsonStringEnumConverter() } };
    public ApiTests(ApiFactory factory) => this.factory = factory;

    private static async Task<HttpResponseMessage> Write(HttpClient client, HttpMethod method, string path, object? body = null, string? xml = null)
    {
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        if (xml is not null) request.Content = new StringContent(xml, Encoding.UTF8, "application/xml");
        else if (body is not null) request.Content = JsonContent.Create(body, options: Json);
        return await client.SendAsync(request);
    }
    private async Task<HttpClient> Account(ApiFactory? scopedFactory = null)
    {
        var client = (scopedFactory ?? factory).CreateClient();
        var response = await Write(client, HttpMethod.Post, "/api/auth/register", new { username = $"user-{Guid.NewGuid():N}"[..28], password = "Portfolio123", displayName = "Test viewer" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return client;
    }
    private static LibraryRequest Input(int episodes = 3, WatchStatus status = WatchStatus.Watching, Guid? revision = null) => new(status, episodes, 8, "Private notes", revision);

    private static async Task<HttpResponseMessage> Picture(HttpClient client, byte[] bytes, string type = "image/png")
    {
        var csrf = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        var request = new HttpRequestMessage(HttpMethod.Put, "/api/profile/avatar") { Content = new ByteArrayContent(bytes) };
        request.Headers.Add("X-CSRF-TOKEN", csrf.GetProperty("token").GetString());
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(type);
        return await client.SendAsync(request);
    }

    [Fact]
    public async Task Profile_picture_is_resized_persisted_private_and_removable()
    {
        using var scoped = new ApiFactory();
        using var alice = await Account(scoped); using var bob = await Account(scoped); using var visitor = scoped.CreateClient();
        using var source = new SKBitmap(400, 200);
        source.Erase(new SKColor(120, 160, 100));
        using var png = source.Encode(SKEncodedImageFormat.Png, 100);
        var response = await Picture(alice, png.ToArray());
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = (await response.Content.ReadFromJsonAsync<UserResponse>(Json))!;
        Assert.NotNull(user.AvatarUrl);
        Assert.Equal(user.AvatarUrl, (await alice.GetFromJsonAsync<UserResponse>("/api/auth/me", Json))!.AvatarUrl);
        using var downloaded = await alice.GetAsync(user.AvatarUrl);
        Assert.Equal("image/png", downloaded.Content.Headers.ContentType!.MediaType);
        Assert.True(downloaded.Headers.CacheControl!.NoStore);
        using var thumbnail = SKBitmap.Decode(await downloaded.Content.ReadAsByteArrayAsync());
        Assert.Equal(256, thumbnail.Width); Assert.Equal(256, thumbnail.Height);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync(user.AvatarUrl)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync(user.AvatarUrl)).StatusCode);
        var replaced = (await (await Picture(alice, png.ToArray())).Content.ReadFromJsonAsync<UserResponse>(Json))!;
        Assert.NotEqual(user.AvatarUrl, replaced.AvatarUrl);
        Assert.Equal(HttpStatusCode.NotFound, (await alice.GetAsync(user.AvatarUrl)).StatusCode);
        var edited = await Write(alice, HttpMethod.Put, "/api/profile", new { displayName = "Updated name", bio = "Still my picture" });
        Assert.Equal(replaced.AvatarUrl, (await edited.Content.ReadFromJsonAsync<UserResponse>(Json))!.AvatarUrl);
        var removed = (await (await Write(alice, HttpMethod.Delete, "/api/profile/avatar")).Content.ReadFromJsonAsync<UserResponse>(Json))!;
        Assert.Null(removed.AvatarUrl);
        Assert.Equal(HttpStatusCode.NotFound, (await alice.GetAsync(replaced.AvatarUrl)).StatusCode);
        Assert.Null((await bob.GetFromJsonAsync<UserResponse>("/api/auth/me", Json))!.AvatarUrl);
    }

    [Theory]
    [InlineData("jpeg")]
    [InlineData("webp")]
    public async Task Profile_picture_accepts_other_supported_formats(string format)
    {
        using var scoped = new ApiFactory();
        using var client = await Account(scoped);
        using var image = new SKBitmap(20, 40);
        image.Erase(SKColors.Coral);
        using var stream = image.Encode(format == "jpeg" ? SKEncodedImageFormat.Jpeg : SKEncodedImageFormat.Webp, 90);
        Assert.Equal(HttpStatusCode.OK, (await Picture(client, stream.ToArray(), "image/" + format)).StatusCode);
    }

    [Fact]
    public async Task Profile_picture_rejects_invalid_oversized_and_unprotected_uploads()
    {
        using var scoped = new ApiFactory();
        using var client = await Account(scoped);
        using var visitor = scoped.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Picture(visitor, [1, 2, 3])).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsync("/api/profile/avatar", new ByteArrayContent([1, 2, 3]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Picture(client, Encoding.UTF8.GetBytes("<svg onload='alert(1)'/>"), "image/svg+xml")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Picture(client, [137, 80, 78, 71, 13, 10, 26, 10])).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await Picture(client, new byte[2 * 1024 * 1024 + 1])).StatusCode);
        using var wide = new SKBitmap(8193, 1);
        using var stream = wide.Encode(SKEncodedImageFormat.Png, 100);
        Assert.Equal(HttpStatusCode.BadRequest, (await Picture(client, stream.ToArray())).StatusCode);
        Assert.Null((await client.GetFromJsonAsync<UserResponse>("/api/auth/me", Json))!.AvatarUrl);
    }

    [Fact]
    public async Task Demo_visitors_get_separate_accounts_and_independent_libraries()
    {
        using var isolated = new ApiFactory();
        using var first = isolated.CreateClient();
        using var second = isolated.CreateClient();
        var firstUser = await (await Write(first, HttpMethod.Post, "/api/auth/demo")).Content.ReadFromJsonAsync<UserResponse>(Json);
        var secondUser = await (await Write(second, HttpMethod.Post, "/api/auth/demo")).Content.ReadFromJsonAsync<UserResponse>(Json);
        Assert.NotEqual(firstUser!.Id, secondUser!.Id);
        var firstList = (await first.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!;
        var secondList = (await second.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!;
        Assert.Equal(7, firstList.Length);
        Assert.Equal(7, secondList.Length);
        var target = firstList[0];
        Assert.Equal(HttpStatusCode.NoContent, (await Write(first, HttpMethod.Delete, $"/api/library/{target.AnimeId}?revision={target.Revision}")).StatusCode);
        Assert.Equal(7, (await second.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!.Length);
    }

    [Fact]
    public async Task Public_catalog_supports_search_filters_and_distinct_pages()
    {
        using var client = factory.CreateClient();
        var search = await client.GetFromJsonAsync<JsonElement>("/api/catalog?search=FRIEREN");
        Assert.Contains(search.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetInt32() == 52991);
        var movies = await client.GetFromJsonAsync<JsonElement>("/api/catalog?format=Movie");
        Assert.All(movies.GetProperty("items").EnumerateArray(), item => Assert.Equal("Movie", item.GetProperty("format").GetString()));
        var first = await client.GetFromJsonAsync<JsonElement>("/api/catalog?page=1&pageSize=4");
        var second = await client.GetFromJsonAsync<JsonElement>("/api/catalog?page=2&pageSize=4");
        var ids = first.GetProperty("items").EnumerateArray().Select(a => a.GetProperty("id").GetInt32());
        Assert.DoesNotContain(second.GetProperty("items").EnumerateArray(), a => ids.Contains(a.GetProperty("id").GetInt32()));
    }

    [Fact]
    public async Task Private_library_requires_a_session_and_writes_require_csrf()
    {
        using var visitor = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/library")).StatusCode);
        using var client = await Account();
        var withoutCsrf = await client.PutAsJsonAsync("/api/library/52991", Input(), Json);
        Assert.Equal(HttpStatusCode.BadRequest, withoutCsrf.StatusCode);
    }

    [Fact]
    public async Task Account_can_log_out_and_sign_in_again()
    {
        using var client = factory.CreateClient();
        var username = $"login-{Guid.NewGuid():N}"[..28];
        Assert.Equal(HttpStatusCode.OK, (await Write(client, HttpMethod.Post, "/api/auth/register", new { username, password = "Portfolio123", displayName = "Viewer" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Write(client, HttpMethod.Post, "/api/auth/logout")).StatusCode);
        Assert.Equal("null", await client.GetStringAsync("/api/auth/me"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Write(client, HttpMethod.Post, "/api/auth/login", new { username, password = "Wrong123" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Write(client, HttpMethod.Post, "/api/auth/login", new { username, password = "Portfolio123" })).StatusCode);
    }

    [Fact]
    public async Task User_library_and_private_notes_are_isolated()
    {
        using var alice = await Account(); using var bob = await Account();
        var created = await Write(alice, HttpMethod.Put, "/api/library/52991", Input());
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        var entry = (await created.Content.ReadFromJsonAsync<LibraryResponse>(Json))!;
        Assert.Empty((await bob.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!);
        Assert.Equal(HttpStatusCode.NotFound, (await Write(bob, HttpMethod.Delete, $"/api/library/52991?revision={entry.Revision}")).StatusCode);
        Assert.Single((await alice.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!);
    }

    [Theory]
    [InlineData(-1, 8)]
    [InlineData(29, 8)]
    [InlineData(1, 11)]
    [InlineData(1, 0)]
    public async Task Invalid_progress_and_scores_do_not_write_to_library(int episodes, int score)
    {
        using var client = await Account();
        var response = await Write(client, HttpMethod.Put, "/api/library/52991", Input(episodes) with { Score = score });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!);
    }

    [Fact]
    public async Task Finishing_last_episode_completes_title_and_stale_updates_are_rejected()
    {
        using var client = await Account();
        var created = (await (await Write(client, HttpMethod.Put, "/api/library/52991", Input(27))).Content.ReadFromJsonAsync<LibraryResponse>(Json))!;
        var update = Input(28, revision: created.Revision);
        var completed = (await (await Write(client, HttpMethod.Put, "/api/library/52991", update)).Content.ReadFromJsonAsync<LibraryResponse>(Json))!;
        Assert.Equal(WatchStatus.Completed, completed.Status);
        Assert.Equal(HttpStatusCode.Conflict, (await Write(client, HttpMethod.Put, "/api/library/52991", update)).StatusCode);
        var stats = await client.GetFromJsonAsync<JsonElement>("/api/insights");
        Assert.Equal(28, stats.GetProperty("episodesWatched").GetInt32());
        Assert.Equal(11.2, stats.GetProperty("hoursWatched").GetDouble());
        Assert.Equal(HttpStatusCode.NoContent, (await Write(client, HttpMethod.Delete, $"/api/library/52991?revision={completed.Revision}")).StatusCode);
    }

    [Fact]
    public async Task Mal_xml_round_trips_progress_ratings_and_notes()
    {
        using var source = await Account(); using var destination = await Account();
        Assert.Equal(HttpStatusCode.OK, (await Write(source, HttpMethod.Put, "/api/library/52991", Input(12))).StatusCode);
        var xml = await source.GetStringAsync("/api/library/export");
        var imported = await Write(destination, HttpMethod.Post, "/api/library/import", xml: xml);
        Assert.Equal(HttpStatusCode.OK, imported.StatusCode);
        var entries = (await destination.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!;
        var entry = Assert.Single(entries);
        Assert.Equal(12, entry.EpisodesWatched); Assert.Equal(8, entry.Score); Assert.Equal("Private notes", entry.Notes);
    }

    [Fact]
    public async Task Malformed_and_unsafe_xml_are_rejected_atomically()
    {
        using var client = await Account();
        foreach (var xml in new[] { "not xml", "<!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///nonexistent'>]><myanimelist>&xxe;</myanimelist>",
            "<myanimelist><anime><series_animedb_id>52991</series_animedb_id><my_status>Watching</my_status><my_watched_episodes>2</my_watched_episodes></anime><anime><series_animedb_id>5114</series_animedb_id><my_status>Watching</my_status><my_watched_episodes>-1</my_watched_episodes></anime></myanimelist>" })
            Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, HttpMethod.Post, "/api/library/import", xml: xml)).StatusCode);
        Assert.Empty((await client.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!);
    }

    [Fact]
    public async Task Expanded_catalog_has_attribution_alias_search_and_clamped_pagination()
    {
        using var client = factory.CreateClient();
        var info = await client.GetFromJsonAsync<JsonElement>("/api/catalog/info");
        Assert.True(info.GetProperty("titleCount").GetInt32() >= 28000);
        Assert.Equal("2026-07-04", info.GetProperty("lastUpdated").GetString());
        Assert.Contains("ODbL", info.GetProperty("licenseName").GetString());
        var alias = await client.GetFromJsonAsync<JsonElement>("/api/catalog?search=notatnik%20%C5%9Bmierci");
        Assert.Contains(alias.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetInt32() == 1535);
        var greek = await client.GetFromJsonAsync<JsonElement>("/api/catalog?search=" + Uri.EscapeDataString("τετράδιο θανάτου"));
        Assert.Contains(greek.GetProperty("items").EnumerateArray(), item => item.GetProperty("id").GetInt32() == 1535);
        var last = await client.GetFromJsonAsync<JsonElement>("/api/catalog?page=2147483647");
        Assert.Equal(last.GetProperty("totalPages").GetInt32(), last.GetProperty("page").GetInt32());
        Assert.NotEmpty(last.GetProperty("items").EnumerateArray());
        var empty = await client.GetFromJsonAsync<JsonElement>("/api/catalog?search=zzzz-unmatched-title-zzzz&page=50");
        Assert.Equal(0, empty.GetProperty("total").GetInt32());
        Assert.Equal(1, empty.GetProperty("page").GetInt32());
        var years = await client.GetFromJsonAsync<JsonElement>("/api/catalog/filters");
        Assert.DoesNotContain(years.GetProperty("years").EnumerateArray(), value => value.GetInt32() == 0);
    }

    [Fact]
    public async Task Regular_guest_prefixed_accounts_are_not_marked_as_demo_and_import_copy_is_singular()
    {
        using var isolated = factory.WithWebHostBuilder(_ => { });
        using var client = isolated.CreateClient();
        var response = await Write(client, HttpMethod.Post, "/api/auth/register", new { username = $"guest-{Guid.NewGuid():N}"[..28], password = "Portfolio123", displayName = "Regular viewer" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var user = (await response.Content.ReadFromJsonAsync<UserResponse>(Json))!;
        Assert.False(user.IsDemo);
        var imported = await Write(client, HttpMethod.Post, "/api/library/import", xml: "<myanimelist><anime><series_animedb_id>52991</series_animedb_id><my_status>Watching</my_status><my_watched_episodes>1</my_watched_episodes></anime></myanimelist>");
        Assert.Equal(HttpStatusCode.OK, imported.StatusCode);
        var result = await imported.Content.ReadFromJsonAsync<JsonElement>();
        Assert.StartsWith("Imported 1 title:", result.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Catalog_refresh_preserves_accounts_progress_ratings_and_private_notes()
    {
        using var isolated = factory.WithWebHostBuilder(_ => { });
        using var client = isolated.CreateClient();
        var signup = await Write(client, HttpMethod.Post, "/api/auth/register", new { username = $"refresh-{Guid.NewGuid():N}"[..28], password = "Portfolio123", displayName = "Keep my profile" });
        var user = (await signup.Content.ReadFromJsonAsync<UserResponse>(Json))!;
        var saved = await Write(client, HttpMethod.Put, "/api/library/52991", Input(7));
        var before = (await saved.Content.ReadFromJsonAsync<LibraryResponse>(Json))!;
        await using (var scope = isolated.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            (await db.CatalogSnapshots.SingleAsync()).Version = "old-snapshot";
            (await db.Anime.FindAsync(52991))!.Title = "An old catalog title";
            await db.SaveChangesAsync();
            await CatalogSeeder.UpdateAsync(db, scope.ServiceProvider.GetRequiredService<IWebHostEnvironment>().ContentRootPath, scope.ServiceProvider.GetRequiredService<ILogger<ApiTests>>());
        }
        var entries = (await client.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!;
        var after = Assert.Single(entries);
        Assert.Equal(before.Revision, after.Revision);
        Assert.Equal(7, after.EpisodesWatched);
        Assert.Equal(8, after.Score);
        Assert.Equal("Private notes", after.Notes);
        Assert.Equal("Frieren: Beyond Journey's End", after.Anime.Title);
        Assert.Equal(user.Id, (await client.GetFromJsonAsync<UserResponse>("/api/auth/me", Json))!.Id);
    }

    [Fact]
    public async Task Whitespace_does_not_bypass_username_length_validation()
    {
        using var isolated = factory.WithWebHostBuilder(_ => { });
        using var client = isolated.CreateClient();
        var response = await Write(client, HttpMethod.Post, "/api/auth/register", new { username = " a ", password = "Portfolio123", displayName = "Viewer" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}

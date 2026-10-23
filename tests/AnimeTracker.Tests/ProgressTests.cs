using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using AnimeTracker.Api.Data;
using AnimeTracker.Api.Domain;
using AnimeTracker.Api.Features;
using Microsoft.Extensions.DependencyInjection;

namespace AnimeTracker.Tests;

public sealed class ProgressTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    { Converters = { new JsonStringEnumConverter() } };

    private static async Task<HttpResponseMessage> Write(HttpClient client, HttpMethod method, string path, object? body = null, string? xml = null)
    {
        var token = await client.GetFromJsonAsync<JsonElement>("/api/auth/csrf");
        var request = new HttpRequestMessage(method, path);
        request.Headers.Add("X-CSRF-TOKEN", token.GetProperty("token").GetString());
        if (xml is not null) request.Content = new StringContent(xml, Encoding.UTF8, "application/xml");
        else if (body is not null) request.Content = JsonContent.Create(body, options: Json);
        return await client.SendAsync(request);
    }

    private async Task<HttpClient> Account()
    {
        var client = factory.CreateClient();
        var registered = await Write(client, HttpMethod.Post, "/api/auth/register", new { username = $"log-{Guid.NewGuid():N}"[..28], password = "Portfolio123", displayName = "Viewer" });
        Assert.Equal(HttpStatusCode.OK, registered.StatusCode);
        return client;
    }

    private static async Task<LibraryResponse> Save(HttpClient client, int animeId, LibraryRequest input)
    {
        var response = await Write(client, HttpMethod.Put, $"/api/library/{animeId}", input);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<LibraryResponse>(Json))!;
    }

    [Fact]
    public async Task History_records_real_changes_survives_removal_and_is_private()
    {
        using var alice = await Account(); using var bob = await Account(); using var visitor = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/history")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await visitor.GetAsync("/api/achievements")).StatusCode);
        var input = new LibraryRequest(WatchStatus.Watching, 1, null, "", null);
        var added = await Save(alice, 52991, input);
        var unchanged = await Save(alice, 52991, input with { Revision = added.Revision });
        var changed = await Save(alice, 52991, input with { EpisodesWatched = 2, Score = 9, Notes = "Do not copy these private notes into the history", Revision = unchanged.Revision });
        Assert.Equal(HttpStatusCode.Conflict, (await Write(alice, HttpMethod.Put, "/api/library/52991", input with { Revision = added.Revision })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(alice, HttpMethod.Put, "/api/library/52991", input with { EpisodesWatched = -1, Revision = changed.Revision })).StatusCode);
        var completed = await Save(alice, 52991, input with { EpisodesWatched = 28, Revision = changed.Revision });
        Assert.Equal(HttpStatusCode.NoContent, (await Write(alice, HttpMethod.Delete, $"/api/library/52991?revision={completed.Revision}")).StatusCode);
        var history = await alice.GetFromJsonAsync<JsonElement>("/api/history");
        Assert.Equal(4, history.GetProperty("total").GetInt32());
        var items = history.GetProperty("items").EnumerateArray().ToArray();
        Assert.Equal("Removed", items[0].GetProperty("kind").GetString());
        Assert.Equal("Frieren: Beyond Journey's End", items[0].GetProperty("title").GetString());
        Assert.Equal("Completed", items[1].GetProperty("toStatus").GetString());
        Assert.Equal(1, items[2].GetProperty("fromEpisodes").GetInt32());
        Assert.Equal(2, items[2].GetProperty("toEpisodes").GetInt32());
        Assert.True(items[2].GetProperty("notesChanged").GetBoolean());
        Assert.EndsWith("Z", items[0].GetProperty("occurredAt").GetString());
        Assert.DoesNotContain("Do not copy", history.ToString());
        Assert.Equal(0, (await bob.GetFromJsonAsync<JsonElement>("/api/history")).GetProperty("total").GetInt32());
        Assert.Empty((await alice.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!);
    }

    [Fact]
    public async Task History_pagination_is_stable_and_clamps_page_boundaries()
    {
        using var client = await Account();
        Guid? revision = null;
        for (var episodes = 0; episodes < 23; episodes++)
            revision = (await Save(client, 52991, new(WatchStatus.Watching, episodes, null, "", revision))).Revision;
        var first = await client.GetFromJsonAsync<JsonElement>("/api/history?page=-1");
        var second = await client.GetFromJsonAsync<JsonElement>("/api/history?page=2147483647");
        Assert.Equal(23, first.GetProperty("total").GetInt32());
        Assert.Equal(1, first.GetProperty("page").GetInt32());
        Assert.Equal(2, second.GetProperty("page").GetInt32());
        Assert.Equal(20, first.GetProperty("items").GetArrayLength());
        Assert.Equal(3, second.GetProperty("items").GetArrayLength());
        var ids = first.GetProperty("items").EnumerateArray().Concat(second.GetProperty("items").EnumerateArray()).Select(a => a.GetProperty("id").GetInt64()).ToArray();
        Assert.Equal(23, ids.Distinct().Count());
        Assert.Equal(ids.OrderDescending(), ids);
    }

    [Fact]
    public async Task Achievements_unlock_once_and_survive_correcting_and_removing_progress()
    {
        using var alice = await Account(); using var bob = await Account();
        var initial = await alice.GetFromJsonAsync<JsonElement>("/api/achievements");
        Assert.Equal(0, initial.GetProperty("unlocked").GetInt32());
        Assert.Equal(9, initial.GetProperty("total").GetInt32());
        var movie = await Save(alice, 199, new(WatchStatus.Completed, 1, 9, "", null));
        var earned = (await alice.GetFromJsonAsync<JsonElement>("/api/achievements")).GetProperty("items").EnumerateArray().Where(a => a.GetProperty("unlockedAt").ValueKind == JsonValueKind.String).ToDictionary(a => a.GetProperty("code").GetString()!, a => a.GetProperty("unlockedAt").GetString());
        Assert.Contains("first-title", earned.Keys); Assert.Contains("first-finish", earned.Keys); Assert.Contains("movie-night", earned.Keys);
        movie = await Save(alice, 199, new(WatchStatus.PlanToWatch, 0, null, "", movie.Revision));
        Assert.Equal(HttpStatusCode.NoContent, (await Write(alice, HttpMethod.Delete, $"/api/library/199?revision={movie.Revision}")).StatusCode);
        var final = await alice.GetFromJsonAsync<JsonElement>("/api/achievements");
        Assert.Equal(earned.Count, final.GetProperty("unlocked").GetInt32());
        foreach (var item in final.GetProperty("items").EnumerateArray())
            if (earned.TryGetValue(item.GetProperty("code").GetString()!, out var date))
            {
                Assert.Equal(date, item.GetProperty("unlockedAt").GetString());
                Assert.EndsWith("Z", date);
                Assert.Equal(item.GetProperty("target").GetInt64(), item.GetProperty("progress").GetInt64());
            }
        Assert.Equal(0, (await bob.GetFromJsonAsync<JsonElement>("/api/achievements")).GetProperty("unlocked").GetInt32());
    }

    [Fact]
    public async Task Imports_record_one_honest_batch_event_and_invalid_imports_add_nothing()
    {
        using var client = await Account();
        const string xml = "<myanimelist><anime><series_animedb_id>1</series_animedb_id><my_status>Completed</my_status><my_score>8</my_score><my_watched_episodes>26</my_watched_episodes></anime><anime><series_animedb_id>9253</series_animedb_id><my_status>Completed</my_status><my_watched_episodes>24</my_watched_episodes></anime><anime><series_animedb_id>999999</series_animedb_id></anime></myanimelist>";
        Assert.Equal(HttpStatusCode.OK, (await Write(client, HttpMethod.Post, "/api/library/import", xml: xml)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Write(client, HttpMethod.Post, "/api/library/import", xml: xml)).StatusCode);
        var invalid = xml.Replace("<my_score>8</my_score>", "<my_score>9</my_score>").Replace("<my_watched_episodes>24</my_watched_episodes>", "<my_watched_episodes>-1</my_watched_episodes>");
        Assert.Equal(HttpStatusCode.BadRequest, (await Write(client, HttpMethod.Post, "/api/library/import", xml: invalid)).StatusCode);
        var history = await client.GetFromJsonAsync<JsonElement>("/api/history");
        Assert.Equal(2, history.GetProperty("total").GetInt32());
        var items = history.GetProperty("items").EnumerateArray().ToArray();
        Assert.All(items, a => Assert.Equal("Imported", a.GetProperty("kind").GetString()));
        Assert.Equal(2, items[1].GetProperty("importedAdded").GetInt32());
        Assert.Equal(2, items[0].GetProperty("importedUpdated").GetInt32());
        Assert.Equal(1, items[0].GetProperty("importedSkipped").GetInt32());
        Assert.Equal(8, (await client.GetFromJsonAsync<LibraryResponse[]>("/api/library", Json))!.Single(e => e.AnimeId == 1).Score);
        Assert.True((await client.GetFromJsonAsync<JsonElement>("/api/achievements")).GetProperty("unlocked").GetInt32() >= 2);
    }

    [Fact]
    public async Task Existing_saved_progress_is_recognized_without_inventing_history()
    {
        using var client = await Account();
        var user = (await client.GetFromJsonAsync<UserResponse>("/api/auth/me", Json))!;
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Library.Add(new LibraryEntry { UserId = user.Id, AnimeId = 199, Status = WatchStatus.Completed, EpisodesWatched = 1 });
            await db.SaveChangesAsync();
            await Milestones.RecognizeExistingAsync(db);
            await Milestones.RecognizeExistingAsync(db);
        }
        Assert.Equal(0, (await client.GetFromJsonAsync<JsonElement>("/api/history")).GetProperty("total").GetInt32());
        var achievements = (await client.GetFromJsonAsync<JsonElement>("/api/achievements")).GetProperty("items").EnumerateArray().ToArray();
        Assert.Contains(achievements, a => a.GetProperty("code").GetString() == "movie-night" && a.GetProperty("unlockedAt").ValueKind == JsonValueKind.String);
    }
}

using AnimeTracker.Api.Data;
using AnimeTracker.Api.Domain;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace AnimeTracker.Api.Features;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this WebApplication app)
    {
        var auth = app.MapGroup("/api/auth").WithTags("Account");
        auth.MapGet("/csrf", (HttpContext context, IAntiforgery antiforgery) =>
            Results.Ok(new { token = antiforgery.GetAndStoreTokens(context).RequestToken }));
        auth.MapGet("/me", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
            (await users.GetUserAsync(principal)) is { } user
                ? Results.Ok(user.ToResponse())
                : Results.Content("null", "application/json"));

        auth.MapPost("/register", async (RegisterRequest request, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            var username = request.Username?.Trim();
            var displayName = request.DisplayName?.Trim();
            if (string.IsNullOrWhiteSpace(username) || username.Length is < 3 or > 30 ||
                string.IsNullOrWhiteSpace(displayName) || displayName.Length > 50 ||
                request.Password is null || request.Password.Length > 128)
                return Results.Problem("Use a 3–30 character username and a display name up to 50 characters.", statusCode: 400);
            var user = new AppUser { UserName = username, DisplayName = displayName };
            var result = await users.CreateAsync(user, request.Password);
            if (!result.Succeeded)
                return Results.Problem(string.Join(" ", result.Errors.Select(e => e.Description)), statusCode: 400);
            await signIn.SignInAsync(user, false);
            return Results.Ok(user.ToResponse());
        }).RequireRateLimiting("auth");

        auth.MapPost("/login", async (Credentials request, UserManager<AppUser> users, SignInManager<AppUser> signIn) =>
        {
            if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
                return Results.Problem("Enter a username and password.", statusCode: 400);
            var user = await users.FindByNameAsync(request.Username.Trim());
            if (user is null) return Results.Problem("The username or password is incorrect.", statusCode: 401);
            var result = await signIn.PasswordSignInAsync(user, request.Password, false, lockoutOnFailure: true);
            if (!result.Succeeded)
                return Results.Problem(result.IsLockedOut ? "Too many attempts. Try again in 5 minutes." : "The username or password is incorrect.", statusCode: 401);
            return Results.Ok(user.ToResponse());
        }).RequireRateLimiting("auth");

        auth.MapPost("/logout", async (SignInManager<AppUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        }).RequireAuthorization();

        // Every demo visitor gets a separate account. Only enabled in Development by default.
        if (app.Configuration.GetValue<bool>("Demo:Enabled"))
        {
            auth.MapPost("/demo", async (UserManager<AppUser> users, SignInManager<AppUser> signIn, AppDbContext db) =>
            {
                var user = new AppUser { UserName = $"guest-{Guid.NewGuid():N}", DisplayName = "Alex", IsDemo = true };
                var created = await users.CreateAsync(user);
                if (!created.Succeeded) return Results.Problem("Could not create a demo session.", statusCode: 500);
                var titles = await db.Anime.Where(a => a.FeaturedOrder > 0).OrderBy(a => a.FeaturedOrder).Take(7).ToListAsync();
                for (var i = 0; i < titles.Count; i++)
                {
                    var anime = titles[i];
                    var status = i < 3 ? WatchStatus.Watching : i < 5 ? WatchStatus.Completed : WatchStatus.PlanToWatch;
                    var entry = new LibraryEntry { UserId = user.Id, AnimeId = anime.Id, Anime = anime };
                    entry.Apply(new(status, Math.Min(5 + i * 2, Math.Max(0, anime.Episodes - 1)), i < 5 ? 8 + i % 3 : null, "", null), anime);
                    db.Library.Add(entry);
                    ProgressLog.Record(db, entry, null);
                }
                await ProgressLog.SaveAsync(db, user.Id);
                await signIn.SignInAsync(user, false);
                return Results.Ok(user.ToResponse());
            }).RequireRateLimiting("auth");
        }

        app.MapPut("/api/profile", async (ProfileRequest request, ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            if (string.IsNullOrWhiteSpace(request.DisplayName) || request.DisplayName.Length > 50 || request.Bio is null || request.Bio.Length > 300)
                return Results.Problem("Display name is required (50 characters maximum). Bio can be up to 300 characters.", statusCode: 400);
            var user = (await users.GetUserAsync(principal))!;
            user.DisplayName = request.DisplayName.Trim();
            user.Bio = request.Bio.Trim();
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.Ok(user.ToResponse()) : Results.Problem("Could not update profile.", statusCode: 400);
        }).RequireAuthorization().WithTags("Account");
    }
}

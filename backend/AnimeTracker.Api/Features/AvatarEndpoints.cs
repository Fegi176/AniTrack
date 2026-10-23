using System.Security.Claims;
using AnimeTracker.Api.Data;
using AnimeTracker.Api.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace AnimeTracker.Api.Features;

public static class AvatarEndpoints
{
    private const int MaxBytes = 2 * 1024 * 1024;

    public static void MapAvatarEndpoints(this WebApplication app)
    {
        var profile = app.MapGroup("/api/profile/avatar").RequireAuthorization().WithTags("Account");
        profile.MapGet("/{userId}/{version}", async (string userId, string version, ClaimsPrincipal principal, AppDbContext db, HttpContext context) =>
        {
            context.Response.Headers.CacheControl = "private, no-store";
            if (principal.FindFirstValue(ClaimTypes.NameIdentifier) != userId) return Results.NotFound();
            var avatar = await db.Users.Where(u => u.Id == userId && u.AvatarVersion == version).Select(u => u.Avatar).FirstOrDefaultAsync();
            return avatar is null ? Results.NotFound() : Results.Bytes(avatar, "image/png");
        });
        profile.MapPut("/", async (HttpContext context, ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            if (context.Request.ContentLength > MaxBytes)
                return Results.Problem("Choose a picture smaller than 2 MB.", statusCode: 413);
            if (context.Request.ContentType is not ("image/jpeg" or "image/png" or "image/webp"))
                return Results.Problem("Choose a JPG, PNG, or WebP picture.", statusCode: 400);

            using var input = new MemoryStream();
            var buffer = new byte[81920];
            while (true)
            {
                var read = await context.Request.Body.ReadAsync(buffer.AsMemory(0, Math.Min(buffer.Length, MaxBytes + 1 - (int)input.Length)), context.RequestAborted);
                if (read == 0) break;
                input.Write(buffer, 0, read);
                if (input.Length > MaxBytes)
                    return Results.Problem("Choose a picture smaller than 2 MB.", statusCode: 413);
            }
            using var data = SKData.CreateCopy(input.ToArray());
            using var codec = SKCodec.Create(data);
            if (codec is null || codec.EncodedFormat is not (SKEncodedImageFormat.Jpeg or SKEncodedImageFormat.Png or SKEncodedImageFormat.Webp))
                return Results.Problem("This picture could not be read. Try another JPG, PNG, or WebP file.", statusCode: 400);
            var info = codec.Info;
            if (info.Width > 8192 || info.Height > 8192 || (long)info.Width * info.Height > 16_000_000)
                return Results.Problem("Choose a picture with no more than 16 million pixels and sides up to 8,192 pixels.", statusCode: 400);
            using var bitmap = new SKBitmap(info.Width, info.Height, SKColorType.Rgba8888, SKAlphaType.Premul);
            if (codec.GetPixels(bitmap.Info, bitmap.GetPixels()) != SKCodecResult.Success)
                return Results.Problem("This picture could not be read. Try another JPG, PNG, or WebP file.", statusCode: 400);
            using var thumbnail = new SKBitmap(256, 256, SKColorType.Rgba8888, SKAlphaType.Premul);
            using (var canvas = new SKCanvas(thumbnail))
            {
                canvas.Clear(SKColors.Transparent);
                canvas.Translate(128, 128);
                canvas.Scale(256f / Math.Min(info.Width, info.Height));
                // Respect phone-camera orientation before taking the centered square crop.
                switch (codec.EncodedOrigin)
                {
                    case SKEncodedOrigin.TopRight: canvas.Scale(-1, 1); break;
                    case SKEncodedOrigin.BottomRight: canvas.RotateDegrees(180); break;
                    case SKEncodedOrigin.BottomLeft: canvas.Scale(1, -1); break;
                    case SKEncodedOrigin.LeftTop: canvas.RotateDegrees(90); canvas.Scale(1, -1); break;
                    case SKEncodedOrigin.RightTop: canvas.RotateDegrees(90); break;
                    case SKEncodedOrigin.RightBottom: canvas.RotateDegrees(90); canvas.Scale(-1, 1); break;
                    case SKEncodedOrigin.LeftBottom: canvas.RotateDegrees(270); break;
                }
                using var image = SKImage.FromBitmap(bitmap);
                canvas.DrawImage(image, -info.Width / 2f, -info.Height / 2f, new SKSamplingOptions(SKCubicResampler.Mitchell));
            }
            using var encoded = thumbnail.Encode(SKEncodedImageFormat.Png, 100);
            var user = (await users.GetUserAsync(principal))!;
            user.Avatar = encoded.ToArray();
            user.AvatarVersion = Guid.NewGuid().ToString("N");
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.Ok(user.ToResponse()) : Results.Problem("Could not save your picture. Please try again.", statusCode: 400);
        });
        profile.MapDelete("/", async (ClaimsPrincipal principal, UserManager<AppUser> users) =>
        {
            var user = (await users.GetUserAsync(principal))!;
            user.Avatar = null;
            user.AvatarVersion = null;
            var result = await users.UpdateAsync(user);
            return result.Succeeded ? Results.Ok(user.ToResponse()) : Results.Problem("Could not remove your picture. Please try again.", statusCode: 400);
        });
    }
}
